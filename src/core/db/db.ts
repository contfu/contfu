import { Database } from "bun:sqlite";
import { Kysely, Migrator, Transaction } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { migrations } from "./migrations/index.ts";
import type { Schema } from "./schema.ts";

export type DbCtx = Kysely<Schema>;

let db: DbCtx;

export function getDb() {
  return db;
}

export function runTransaction<T>(
  callback: (trx: Transaction<Schema>) => Promise<T>
) {
  return getDb().transaction().execute(callback);
}

export async function setupDb(path?: string | null) {
  const dialect = new BunSqliteDialect({
    database: new Database(path ?? ":memory:"),
  });
  db = new Kysely<Schema>({ dialect });
  await migrate();
}

async function migrate() {
  const migrator = new Migrator({
    db: getDb(),
    provider: {
      async getMigrations() {
        return migrations;
      },
    },
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

export async function truncate() {
  await getDb().deleteFrom("componentRelation").execute();
  await getDb().deleteFrom("pageComponent").execute();
  await getDb().deleteFrom("component").execute();
  await getDb().deleteFrom("pageLink").execute();
  await getDb().deleteFrom("page").execute();
  await getDb().deleteFrom("connection").execute();
}
