import { getDb } from "../../core/db/db";
import type { DbConnection, NewConnection } from "../../core/db/schema";

export function getConnections(): Promise<DbConnection[]> {
  return getDb().selectFrom("connection").selectAll().execute();
}

export async function createConnection(
  connection: NewConnection
): Promise<void> {
  await getDb().insertInto("connection").values(connection).execute();
}

export async function updateConnection({
  key,
  target,
  ...conn
}: DbConnection): Promise<void> {
  await getDb()
    .updateTable("connection")
    .set(conn)
    .where((eb) => eb.and({ key, target }))
    .execute();
}

export async function deleteConnection({
  key,
  target,
}: Pick<DbConnection, "key" | "target">): Promise<void> {
  await getDb()
    .deleteFrom("connection")
    .where((eb) => eb.and({ key, target }))
    .execute();
}
