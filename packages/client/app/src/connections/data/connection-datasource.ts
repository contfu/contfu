import { hashId } from "../../core/crypto";
import type { Connection } from "../connections";

export async function createConnection<C extends string>(
  conn: Omit<Connection<C>, "id">,
): Promise<Connection<C>> {
  const id = await hashId(conn.name);
  return { ...conn, id };
}
