import { Connection } from "../connections/connections";
import {
  createOrUpdatePage,
  deletePagesByRefs,
  getPageRefsByCollection,
} from "../pages/data/page-datasource";

export function sync(connections: Connection[]) {
  for (const connection of connections) {
    pull(connection);
    removeOrphans(connection);
  }
}

async function pull(connection: Connection) {
  for (const collection of connection.collectionNames) {
    for await (const page of connection.pull(collection)) {
      await createOrUpdatePage(page);
      // TODO: Take care of links and assets
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
      await deletePagesByRefs(connection.id, [...refsToDelete]);
      // TODO: Take care of links and assets
    }
  }
}
