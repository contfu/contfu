import { getDb, type DbCtx } from "../../core/db/db";
import type { DbConnection, NewConnection } from "../../core/db/schema";

export function getConnections(ctx?: DbCtx): Promise<DbConnection[]> {
  return (ctx ?? getDb()).selectFrom("connection").selectAll().execute();
}

export async function createConnection(
  connection: NewConnection,
  ctx?: DbCtx
): Promise<void> {
  await (ctx ?? getDb()).insertInto("connection").values(connection).execute();
}

export async function updateConnection(
  { key, target, ...conn }: DbConnection,
  ctx?: DbCtx
): Promise<void> {
  await (ctx ?? getDb())
    .updateTable("connection")
    .set(conn)
    .where((eb) => eb.and({ key, target }))
    .execute();
}

export async function deleteConnection(
  { key, target }: Pick<DbConnection, "key" | "target">,
  ctx?: DbCtx
): Promise<void> {
  await (ctx ?? getDb())
    .deleteFrom("connection")
    .where((eb) => eb.and({ key, target }))
    .execute();
}
