import {
  Dialect,
  Insertable,
  Kysely,
  MigrationProvider,
  Migrator,
  Transaction,
  sql,
} from "kysely";
import type { Schema } from "./schema";

export type DbCtx = Kysely<Schema>;

let db: DbCtx;

export function getDb() {
  if (!db) {
    throw new Error("db not initialized");
  }
  return db;
}

export function runTransaction<T>(
  callback: (trx: Transaction<Schema>) => Promise<T>
) {
  return getDb().transaction().execute(callback);
}

export async function setupDb({
  dialect,
  migratonProvider,
}: {
  dialect: Dialect;
  migratonProvider: MigrationProvider;
}) {
  db = new Kysely<Schema>({ dialect });
  await migrate(migratonProvider);
}

export async function insertReturningId<T extends keyof Schema>(
  table: T,
  values: Insertable<Schema[T]>,
  ctx: DbCtx = getDb()
): Promise<number> {
  const id = ctx.getExecutor().adapter.supportsReturning
    ? ((
        await (ctx as Kysely<any>)
          .insertInto(table)
          .values(values)
          .returning("id")
          .executeTakeFirst()
      )?.id as number)
    : (await ctx.insertInto(table).values(values).executeTakeFirst()).insertId;
  return id === undefined
    ? await getSqliteInsertId(ctx)
    : typeof id === "bigint"
    ? Number(id)
    : id;
}

export async function truncate() {
  await getDb().deleteFrom("componentRelation").execute();
  await getDb().deleteFrom("pageComponent").execute();
  await getDb().deleteFrom("component").execute();
  await getDb().deleteFrom("pageLink").execute();
  await getDb().deleteFrom("page").execute();
  await getDb().deleteFrom("connection").execute();
}

export { sqliteMigrationProvider } from "./migrations/sqlite";

async function migrate(provider: MigrationProvider) {
  const migrator = new Migrator({
    db: getDb(),
    provider,
  });
  const { error, results } = await migrator.migrateToLatest();
  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to run `migrateToLatest`");
    console.error(error);
    throw error;
  }
}

async function getSqliteInsertId(ctx: DbCtx = getDb()) {
  return (
    await sql<{ id: number }>`SELECT last_insert_rowid() as id`.execute(ctx)
  ).rows[0].id;
}
