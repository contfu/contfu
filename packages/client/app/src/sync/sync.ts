import type { ImageBlock } from "@contfu/core";
import { extname } from "path";
import type { Source } from "../connections/connections";
import { hashId } from "../core/crypto";
import type { PageData } from "../pages/data/page-data";
import {
  createOrUpdatePage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePageLinksByRef,
  deletePagesByRefs,
  getPage,
  getPageRefsByCollection,
} from "../pages/data/page-datasource";

export function sync(sources: Source[]) {
  return Promise.all(sources.flatMap((c) => [pull(c), removeOrphans(c)]));
}

async function pull(source: Source) {
  const transientLinks = new Map<string, Set<[string, number]>>();
  for (const collection of source.collectionNames) {
    for await (const { page, assets } of source.pull(collection)) {
      const { id } = await createOrUpdatePage(page);
      await deleteOutgoingPageLinks(id);
      await createLinks(page, id, transientLinks);
      await processAssets(source, assets);
    }
  }
}

async function removeOrphans(source: Source) {
  for (const collection of source.collectionNames) {
    for await (const upstreamRefs of source.pullCollectionRefs(collection)) {
      const existingRefs = await getPageRefsByCollection(source.id, collection);
      const refsToDelete = new Set(existingRefs);
      for (const ref of upstreamRefs) refsToDelete.delete(ref);
      if (refsToDelete.size === 0) continue;
      for (const ref of refsToDelete) await deletePageLinksByRef(ref);
      await deletePagesByRefs(source.id, [...refsToDelete]);
      // TODO: Take care of assets
    }
  }
}

async function createLinks(
  page: Omit<PageData, "id">,
  id: number,
  transientLinks: Map<string, Set<[string, number]>>,
) {
  for (const type in page.links) {
    for (const ref of page.links[type]) {
      const target = await getPage({ ref });
      if (target) await createPageLink({ type, from: id, to: target.id });
      else {
        const outgoing = transientLinks.get(ref) ?? new Set();
        outgoing.add([type, id]);
        if (!transientLinks.has(ref)) transientLinks.set(ref, outgoing);
      }
    }
  }
  const incoming = transientLinks.get(page.ref);
  if (incoming) {
    for (const [type, incomingId] of incoming) {
      await createPageLink({ type, from: incomingId, to: id });
    }
    transientLinks.delete(page.ref);
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
