import { hashId } from "../util/crypto";
import type { Connection } from "./connections";

export function createConnection<C extends string>(conn: Omit<Connection<C>, "id">): Connection<C> {
  const id = hashId(conn.name);
  return { ...conn, id };
}
