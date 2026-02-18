import type { AssetData, AssetSyncProgress, ItemData, OnAssetProgress } from "../types/content-types";
import type { ImageBlock } from "@contfu/core";
import { extname } from "path";
import { createAsset } from "../../features/assets/createAsset";
import { deleteAssetsByItem } from "../../features/assets/deleteAssetsByItem";
import { createItemLink } from "../../features/items/createItemLink";
import { createOrUpdateItem } from "../../features/items/createOrUpdateItem";
import { deleteItemLinksByRef } from "../../features/items/deleteItemLinksByRef";
import { deleteItemsByIds } from "../../features/items/deleteItemsByIds";
import { deleteOutgoingItemLinks } from "../../features/items/deleteOutgoingItemLinks";
import { getItem } from "../../features/items/getItem";
import { getItemIdsByCollection } from "../../features/items/getItemIdsByCollection";
import { hashId } from "../../util/crypto";

export interface SyncOptions {
  onProgress?: OnAssetProgress;
}

export interface SyncSource<C extends string = string> {
  id: string;
  collectionNames: C[];
  mediaStore: {
    write(canonical: string, data: Buffer | ReadableStream): Promise<void>;
    read(canonical: string): Promise<Buffer | null>;
    exists(canonical: string): Promise<boolean>;
  };
  mediaOptimizer?: {
    optimizeImage(
      store: {
        write(canonical: string, data: Buffer | ReadableStream): Promise<void>;
        read(canonical: string): Promise<Buffer | null>;
        exists(canonical: string): Promise<boolean>;
      },
      canonical: string,
      asset: ReadableStream,
    ): Promise<void>;
  };
  pull(
    collection: C,
  ): AsyncGenerator<{ item: Omit<ItemData, "id">; assets: { block: ImageBlock; ref: string }[] }>;
  pullCollectionRefs(collection: C): AsyncGenerator<string[]>;
  fetchAsset(url: string): Promise<ReadableStream>;
}

export function sync(sources: SyncSource[], options?: SyncOptions) {
  return Promise.all(sources.flatMap((source) => [pull(source, options), removeOrphans(source)]));
}

async function pull(source: SyncSource, options?: SyncOptions) {
  const transientLinks = new Map<string, Set<[string, string]>>();

  for (const collection of source.collectionNames) {
    for await (const { item, assets } of source.pull(collection)) {
      const id = hashId(`${source.id}|${item.ref}`);
      const fullItem = { ...item, id };

      await createOrUpdateItem(fullItem);
      await deleteOutgoingItemLinks(id);
      await createLinks(item, id, transientLinks);
      await processAssets(source, id, assets, options?.onProgress);
    }
  }
}

async function removeOrphans(source: SyncSource) {
  for (const collection of source.collectionNames) {
    for await (const upstreamIds of source.pullCollectionRefs(collection)) {
      const existingIds = await getItemIdsByCollection(collection);
      const idsToDelete = new Set(existingIds);

      for (const id of upstreamIds) idsToDelete.delete(id);
      if (idsToDelete.size === 0) continue;

      for (const id of idsToDelete) await deleteItemLinksByRef(id);

      for (const ref of idsToDelete) {
        const itemId = hashId(`${source.id}|${ref}`);
        await deleteAssetsByItem(itemId);
      }

      await deleteItemsByIds([...idsToDelete]);
    }
  }
}

async function createLinks(
  item: Omit<ItemData, "id">,
  id: string,
  transientLinks: Map<string, Set<[string, string]>>,
) {
  for (const type in item.links) {
    for (const targetRef of item.links[type]) {
      const target = await getItem({ id: targetRef });

      if (target) {
        await createItemLink({ type, from: id, to: target.id });
      } else {
        const outgoing = transientLinks.get(targetRef) ?? new Set();
        outgoing.add([type, id]);
        if (!transientLinks.has(targetRef)) transientLinks.set(targetRef, outgoing);
      }
    }
  }

  const incoming = transientLinks.get(id);
  if (!incoming) return;

  for (const [type, incomingId] of incoming) {
    await createItemLink({ type, from: incomingId, to: id });
  }
  transientLinks.delete(id);
}

async function processAssets(
  source: SyncSource,
  itemId: string,
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

      reportProgress({ url, name });

      const stream = await source.fetchAsset(url);

      if (!source.mediaOptimizer) {
        await source.mediaStore.write(canonical, stream);
      } else {
        await source.mediaOptimizer.optimizeImage(source.mediaStore, canonical, stream);
      }

      const assetData: AssetData = {
        id: hash,
        itemId,
        canonical,
        originalUrl: url,
        format: ext.replace(".", ""),
        size: 0,
        createdAt: Date.now(),
      };
      await createAsset(assetData);

      completed++;
      reportProgress(null);
    }),
  );
}

function hasMultipleOutputs(ext: string) {
  return optimizedImageExtensions.includes(ext);
}

const optimizedImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
