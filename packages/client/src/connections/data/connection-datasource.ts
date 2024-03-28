import { getDb, insertReturningId } from "../../core/db/db";
import type {
  ConnectionUpdate,
  DbConnection,
  NewConnection,
} from "../../core/db/schema";
import { ConnectionData } from "./connection-data";

export function getConnections(ctx = getDb()): Promise<ConnectionData[]> {
  return ctx.selectFrom("connection").selectAll().execute();
}

export async function createConnection(
  connection: Omit<ConnectionData, "id">,
  ctx = getDb()
): Promise<DbConnection> {
  const id = await insertReturningId(
    "connection",
    connectionToDb(connection),
    ctx
  );
  return { ...connection, id };
}

export async function patchConnection(
  connection: ConnectionData | Omit<ConnectionData, "id">,
  ctx = getDb()
): Promise<void> {
  const { key, target, id, ...conn } = connectionToDb(connection);
  await ctx
    .updateTable("connection")
    .set(conn)
    .where((eb) => eb.and({ key, target }))
    .execute();
}

export async function deleteConnection(
  { key, target }: Pick<ConnectionData, "key" | "target">,
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("connection")
    .where((eb) => eb.and({ key, target }))
    .execute();
}

function connectionToDb<T extends NewConnection | Omit<NewConnection, "id">>(
  connection: T
): T extends NewConnection ? NewConnection : ConnectionUpdate {
  return connection satisfies NewConnection | ConnectionUpdate as any;
}

function connectionFromDb(dbo: DbConnection): NewConnection {
  return dbo;
}
