import { runTransaction } from "../../core/db/db";
import { Connection } from "../connections";
import { connectionToData } from "./connection-data";
import {
  createConnection,
  deleteConnection,
  getConnections,
} from "./connection-datasource";

export async function updateConnections(connections: Connection[]) {
  await runTransaction(async (trx) => {
    const storedConnections = await getConnections(trx);

    for (const conn of connections) {
      let stored = storedConnections.find((c) => connectionEquals(conn, c));
      if (!stored) stored = await createConnection(connectionToData(conn), trx);
      conn.id = stored.id;
    }
    for (const stored of storedConnections) {
      if (!connections.find((c) => connectionEquals(c, stored))) {
        // TODO: Cleanup all related pages, components and files
        await deleteConnection(stored, trx);
      }
    }
  });
}

type ConnectionEqualsFields = Pick<Connection, "name">;

function connectionEquals(
  c1: ConnectionEqualsFields,
  c2: ConnectionEqualsFields
): boolean {
  return c1.name === c2.name;
}
