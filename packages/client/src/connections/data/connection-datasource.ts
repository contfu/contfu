import { getDb, insertReturningId } from "../../core/db/db";
import type {
  ConnectionUpdate,
  DbConnection,
  NewConnection,
} from "../../core/db/schema";
import { deleteNulls } from "../../util/object-helpers";
import { ConnectionData } from "./connection-data";

export async function getConnections(ctx = getDb()): Promise<ConnectionData[]> {
  const dbos = await ctx.selectFrom("connection").selectAll().execute();
  return dbos.map(connectionFromDb);
}

export async function createConnection<T extends Omit<ConnectionData, "id">>(
  connection: T,
  ctx = getDb()
): Promise<T & { id: number }> {
  const id = await insertReturningId(
    "connection",
    connectionToDb(connection),
    ctx
  );
  return { ...connection, id };
}

export async function deleteConnection(
  { name, id }: Partial<Pick<ConnectionData, "name" | "id">>,
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("connection")
    .where((eb) => eb.or({ name, id }))
    .execute();
}

function connectionToDb<T extends NewConnection | Omit<NewConnection, "id">>(
  connection: T
): T extends NewConnection ? NewConnection : ConnectionUpdate {
  return {
    ...("id" in connection ? { id: (connection as any).id } : {}),
    name: connection.name,
  } satisfies NewConnection | ConnectionUpdate as any;
}

function connectionFromDb(dbo: DbConnection): ConnectionData {
  return deleteNulls(dbo);
}
