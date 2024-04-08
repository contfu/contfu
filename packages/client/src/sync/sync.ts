import { Connection } from "../connections/connections";
import {
  createOrUpdatePage,
  deletePagesByRefs,
} from "../pages/data/page-datasource";

export function sync(connections: Connection[]) {
  for (const connection of connections) {
    pull(connection);
    removeOrphans(connection);
  }
}

async function pull(connection: Connection) {
  for await (const page of connection.pull()) {
    await createOrUpdatePage(page);
    // TODO: Take care of links and assets
  }
}

async function removeOrphans(connection: Connection) {
  for await (const allRefs of connection.pullAllRefs()) {
    // FIXME: Other way round. We should delete all pages that are not in allRefs
    await deletePagesByRefs(allRefs);
    // TODO: Take care of links and assets
  }
}
