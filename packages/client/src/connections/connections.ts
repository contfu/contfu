import { runTransaction } from "../core/db/db";
import { NewConnection } from "../core/db/schema";
import {
  createConnection,
  deleteConnection,
  getConnections,
  updateConnection,
} from "./data/connection-datasource";

export async function setConnections(
  connections: NewConnection[]
): Promise<Connection[]> {
  const reslut: Connection[] = [];
  await runTransaction(async (trx) => {
    const storedConnections = await getConnections(trx);

    for (const conn of connections) {
      const stored = storedConnections.find((c) => connectionEquals(conn, c));
      if (stored) {
        await updateConnection({ ...conn, id: stored.id }, trx);
        reslut.push({ ...conn, id: stored.id });
      } else {
        const c = await createConnection(conn, trx);
        reslut.push(c);
      }
    }
    for (const stored of storedConnections) {
      if (!connections.find((c) => connectionEquals(c, stored))) {
        // TODO: Cleanup all related pages, components and files
        await deleteConnection(stored, trx);
      }
    }
  });
  return reslut;
}

export type Connection = {
  id: number;
  name: string;
  key: string;
  target: string;
  type: string;
};

type ConnectionEqualsFields = Pick<Connection, "key" | "target">;

function connectionEquals(
  c1: ConnectionEqualsFields,
  c2: ConnectionEqualsFields
): boolean {
  return c1.key === c2.key && c1.target === c2.target;
}
