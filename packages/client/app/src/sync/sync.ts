import type { ImageBlock } from "@contfu/core";
import { extname } from "path";
import type { Source } from "../connections/connections";
import { hashId } from "../core/crypto";
import type { PageData } from "../pages/pages";
import {
  createOrUpdatePage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePageLinksByRef,
  deletePagesByIds,
  getPage,
  getPageIdsByCollection,
} from "../pages/data/page-datasource";

export function sync(sources: Source[]) {
  return Promise.all(sources.flatMap((c) => [pull(c), removeOrphans(c)]));
}

async function pull(source: Source) {
  const transientLinks = new Map<string, Set<[string, string]>>();
  for (const collection of source.collectionNames) {
    for await (const { page, assets } of source.pull(collection)) {
      const id = hashId(`${source.id}|${page.ref}`);
      const fullPage = { ...page, id, connection: source.id };
      await createOrUpdatePage(fullPage);
      await deleteOutgoingPageLinks(id);
      await createLinks(page, id, transientLinks);
      await processAssets(source, assets);
    }
  }
}

async function removeOrphans(source: Source) {
  for (const collection of source.collectionNames) {
    for await (const upstreamIds of source.pullCollectionRefs(collection)) {
      const existingIds = await getPageIdsByCollection(source.id, collection);
      const idsToDelete = new Set(existingIds);
      for (const id of upstreamIds) idsToDelete.delete(id);
      if (idsToDelete.size === 0) continue;
      for (const id of idsToDelete) await deletePageLinksByRef(id);
      await deletePagesByIds(source.id, [...idsToDelete]);
      // TODO: Take care of assets
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

async function processAssets(source: Source, assets: { block: ImageBlock; ref: string }[]) {
  assets.map(async ({ block, ref }) => {
    const hash = hashId(`${source.id}|${ref}`);
    const ext = extname(ref);
    const url = block[1];
    const canonical = `${hash}${ext}`;
    block[1] = canonical;
    if (await source.mediaStore.exists(hasMulpitleOutputs(ext) ? hash : canonical)) return;
    const asset = await source.fetchAsset(url);

    if (!source.mediaOptimizer) {
      await source.mediaStore.write(canonical, asset);
      return;
    }

    await source.mediaOptimizer.optimizeImage(source.mediaStore, canonical, asset);
  });
}

function hasMulpitleOutputs(ext: string) {
  return optimizedImageExtensions.includes(ext);
}

const optimizedImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
