import { Connection } from "../connections";

export type ConnectionData = Pick<
  Connection,
  "name" | "key" | "target" | "type"
> & { id: number };

export function connectionToData(connection: Connection): ConnectionData {
  return {
    id: (connection as any).id,
    name: connection.name,
    key: connection.key,
    target: connection.target,
    type: connection.type,
  };
}
