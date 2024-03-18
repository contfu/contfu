import { getDb, getInsertId, type DbCtx } from "../../core/db/db";
import type { DbConnection, NewConnection } from "../../core/db/schema";

export function getConnections(ctx?: DbCtx): Promise<DbConnection[]> {
  return (ctx ?? getDb()).selectFrom("connection").selectAll().execute();
}

export async function createConnection(
  connection: NewConnection,
  ctx: DbCtx = getDb()
): Promise<DbConnection> {
  await ctx.insertInto("connection").values(connection).execute();
  return {
    ...connection,
    id: await getInsertId(ctx),
  };
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
