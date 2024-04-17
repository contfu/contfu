import { Connection } from "../connections";

export type ConnectionData = Pick<Connection, "name"> & { id: number };

export function connectionToData(connection: Connection): ConnectionData {
  return {
    id: (connection as any).id,
    name: connection.name,
  };
}
