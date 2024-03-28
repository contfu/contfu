import { runTransaction } from "../../core/db/db";
import { Connection } from "../connections";
import {
  createConnection,
  deleteConnection,
  getConnections,
  patchConnection,
} from "./connection-datasource";

export async function updateConnections(connections: Connection[]) {
  await runTransaction(async (trx) => {
    const storedConnections = await getConnections(trx);

    for (const conn of connections) {
      const stored = storedConnections.find((c) => connectionEquals(conn, c));
      if (stored) {
        await patchConnection({ ...conn, id: stored.id }, trx);
      } else {
        const c = await createConnection(conn, trx);
      }
    }
    for (const stored of storedConnections) {
      if (!connections.find((c) => connectionEquals(c, stored))) {
        // TODO: Cleanup all related pages, components and files
        await deleteConnection(stored, trx);
      }
    }
  });
}

type ConnectionEqualsFields = Pick<Connection, "key" | "target">;

function connectionEquals(
  c1: ConnectionEqualsFields,
  c2: ConnectionEqualsFields
): boolean {
  return c1.key === c2.key && c1.target === c2.target;
}
