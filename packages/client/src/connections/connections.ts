import { runTransaction } from "../core/db/db";
import {
  createConnection,
  deleteConnection,
  getConnections,
  updateConnection,
} from "./data/connection-datasource";

export async function setConnections(connections: Connection[]): Promise<void> {
  await runTransaction(async (trx) => {
    const storedConnections = await getConnections(trx);

    for (const conn of connections) {
      const stored = storedConnections.find((c) => connectionEquals(conn, c));
      if (stored) await updateConnection(conn, trx);
      else await createConnection(conn, trx);
    }
    for (const stored of storedConnections) {
      if (!connections.find((c) => connectionEquals(c, stored))) {
        await deleteConnection(stored, trx);
      }
    }
  });
}

export type Connection = {
  name: string;
  key: string;
  target: string;
  type: string;
};

function connectionEquals(c1: Connection, c2: Connection): boolean {
  return c1.key === c2.key && c1.target === c2.target;
}
