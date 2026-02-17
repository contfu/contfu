import type { ImageBlock } from "@contfu/core";
import { extname } from "path";
import { createAsset, deleteAssetsByPage } from "../assets/asset-datasource";
import type { AssetData, AssetSyncProgress, OnAssetProgress } from "../assets/asset-types";
import type { Source, SyncOptions } from "../connections/connections";
import { hashId } from "../util/crypto";
import type { PageData } from "../pages/pages";
import {
  createOrUpdatePage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePageLinksByRef,
  deletePagesByIds,
  getPage,
  getPageIdsByCollection,
} from "../pages/page-datasource";

export function sync(sources: Source[], options?: SyncOptions) {
  return Promise.all(sources.flatMap((c) => [pull(c, options), removeOrphans(c)]));
}

async function pull(source: Source, options?: SyncOptions) {
  const transientLinks = new Map<string, Set<[string, string]>>();
  for (const collection of source.collectionNames) {
    for await (const { page, assets } of source.pull(collection)) {
      const id = hashId(`${source.id}|${page.ref}`);
      const fullPage = { ...page, id };
      await createOrUpdatePage(fullPage);
      await deleteOutgoingPageLinks(id);
      await createLinks(page, id, transientLinks);
      await processAssets(source, id, assets, options?.onProgress);
    }
  }
}

async function removeOrphans(source: Source) {
  for (const collection of source.collectionNames) {
    for await (const upstreamIds of source.pullCollectionRefs(collection)) {
      const existingIds = await getPageIdsByCollection(collection);
      const idsToDelete = new Set(existingIds);
      for (const id of upstreamIds) idsToDelete.delete(id);
      if (idsToDelete.size === 0) continue;
      for (const id of idsToDelete) await deletePageLinksByRef(id);
      for (const ref of idsToDelete) {
        const pageId = hashId(`${source.id}|${ref}`);
        await deleteAssetsByPage(pageId);
      }
      await deletePagesByIds([...idsToDelete]);
    }
  }
}

async function createLinks(
  page: Omit<PageData, "id">,
  id: string,
  transientLinks: Map<string, Set<[string, string]>>,
) {
  for (const type in page.links) {
    for (const targetRef of page.links[type]) {
      const target = await getPage({ id: targetRef });
      if (target) await createPageLink({ type, from: id, to: target.id });
      else {
        const outgoing = transientLinks.get(targetRef) ?? new Set();
        outgoing.add([type, id]);
        if (!transientLinks.has(targetRef)) transientLinks.set(targetRef, outgoing);
      }
    }
  }
  const incoming = transientLinks.get(id);
  if (incoming) {
    for (const [type, incomingId] of incoming) {
      await createPageLink({ type, from: incomingId, to: id });
    }
    transientLinks.delete(id);
  }
}

async function processAssets(
  source: Source,
  pageId: string,
  assets: { block: ImageBlock; ref: string }[],
  onProgress?: OnAssetProgress,
) {
  const total = assets.length;
  let completed = 0;

  const reportProgress = (
    current: AssetSyncProgress["current"],
    bytesDownloaded = 0,
    bytesTotal = 0,
  ) => {
    if (onProgress) {
      onProgress({ total, completed, current, bytesDownloaded, bytesTotal });
    }
  };

  // Report initial progress if we have assets to process
  if (total > 0) {
    reportProgress(null);
  }

  await Promise.all(
    assets.map(async ({ block, ref }) => {
      const hash = hashId(`${source.id}|${ref}`);
      const ext = extname(ref);
      const url = block[1];
      const canonical = `${hash}${ext}`;
      const name = ref.split("/").pop() || canonical;
      block[1] = canonical;

      if (await source.mediaStore.exists(hasMultipleOutputs(ext) ? hash : canonical)) {
        completed++;
        reportProgress(null);
        return;
      }

      // Report start of download
      reportProgress({ url, name });

      const stream = await source.fetchAsset(url);

      // Stream the asset to storage or optimizer
      if (!source.mediaOptimizer) {
        await source.mediaStore.write(canonical, stream);
      } else {
        await source.mediaOptimizer.optimizeImage(source.mediaStore, canonical, stream);
      }

      // Note: With streaming, we can't easily track byte progress
      // The asset is recorded with size 0; actual size tracking would require
      // a tee stream or post-processing
      const assetData: AssetData = {
        id: hash,
        pageId,
        canonical,
        originalUrl: url,
        format: ext.replace(".", ""),
        size: 0, // Size unknown with streaming; can be updated post-write if needed
        createdAt: Date.now(),
      };
      await createAsset(assetData);

      // Report asset completed
      completed++;
      reportProgress(null);
    }),
  );
}

function hasMultipleOutputs(ext: string) {
  return optimizedImageExtensions.includes(ext);
}

const optimizedImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
