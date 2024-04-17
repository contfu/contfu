import { Connection } from "../connections/connections";
import { PageData } from "../pages/data/page-data";
import {
  createOrUpdatePage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePageLinksByRef,
  deletePagesByRefs,
  getPage,
  getPageRefsByCollection,
} from "../pages/data/page-datasource";

export function sync(connections: Connection[]) {
  for (const connection of connections) {
    pull(connection);
    removeOrphans(connection);
  }
}

async function pull(connection: Connection) {
  const transientLinks = new Map<string, Set<[string, number]>>();
  for (const collection of connection.collectionNames) {
    for await (const page of connection.pull(collection)) {
      const { id } = await createOrUpdatePage(page);
      await deleteOutgoingPageLinks(id);
      await createLinks(page, id, transientLinks);
      // TODO: Take care of assets
    }
  }
}

async function removeOrphans(connection: Connection) {
  for (const collection of connection.collectionNames) {
    for await (const upstreamRefs of connection.pullCollectionRefs(
      collection
    )) {
      const existingRefs = await getPageRefsByCollection(
        connection.id,
        collection
      );
      const refsToDelete = new Set(existingRefs);
      for (const ref of upstreamRefs) refsToDelete.delete(ref);
      if (refsToDelete.size === 0) continue;
      for (const ref of refsToDelete) await deletePageLinksByRef(ref);
      await deletePagesByRefs(connection.id, [...refsToDelete]);
      // TODO: Take care of assets
    }
  }
}

async function createLinks(
  page: Omit<PageData, "id">,
  id: number,
  transientLinks: Map<string, Set<[string, number]>>
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
