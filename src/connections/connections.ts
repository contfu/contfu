import {
  createConnection,
  deleteConnection,
  getConnections,
  updateConnection,
} from "./data/connection-datasource";

export async function setConnections(connections: Connection[]): Promise<void> {
  for (const c1 of connections) {
    for (const c2 of connections) {
      if (c1 !== c2 && connectionEquals(c1, c2)) {
        throw new Error(`Duplicate connection: ${c1.name}, ${c2.name}`);
      }
    }
  }
  const storedConnections = await getConnections();

  for (const conn of connections) {
    const stored = storedConnections.find((c) => connectionEquals(conn, c));
    if (stored) await updateConnection(conn);
    else await createConnection(conn);
  }
  for (const stored of storedConnections) {
    if (!connections.find((c) => connectionEquals(c, stored))) {
      await deleteConnection(stored);
    }
  }
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
