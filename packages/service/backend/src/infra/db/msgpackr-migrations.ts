import { getKvManager } from "../nats/kvm";
import { hasNats } from "../nats/connection";
import { db } from "./db";
import { msgpackrMigrationTable } from "./schema";
import { tables, columnEncodings, type TableName, type ColumnName, type ColumnType } from "./bytea";
import { and, eq } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import { createLogger } from "../logger/index";

const log = createLogger("msgpackr-migrations");

const LEASE_BUCKET = "msgpackr-migrations-lease";
const LEASE_TTL_SECONDS = 60;

export type Migration = {
  [T in TableName]: {
    [C in ColumnName<T>]: {
      table: T;
      column: C;
      version: number;
      migrate: (oldData: any) => ColumnType<T, C>;
    };
  }[ColumnName<T>];
}[TableName];

const tableSchemaRegistry: Record<TableName, any> = tables;

function applyMigration(migration: Migration, oldData: unknown): unknown {
  return migration.migrate(oldData as never);
}

async function acquireLease(): Promise<boolean> {
  if (!hasNats()) return true;

  const kvm = await getKvManager();
  const bucket = await kvm.create(LEASE_BUCKET, { ttl: LEASE_TTL_SECONDS * 1_000_000_000 });

  const leaseKey = "migration-lease";
  const existing = await bucket.get(leaseKey);

  if (existing) {
    log.info("Another instance is running migrations, skipping");
    return false;
  }

  await bucket.put(leaseKey, pack({ startedAt: Date.now() }));
  return true;
}

async function releaseLease(): Promise<void> {
  if (!hasNats()) return;

  try {
    const kvm = await getKvManager();
    const bucket = await kvm.create(LEASE_BUCKET, { ttl: LEASE_TTL_SECONDS * 1_000_000_000 });
    await bucket.delete("migration-lease");
  } catch {
    // Ignore errors on release
  }
}

async function getDbVersion(table: string, column: string): Promise<number> {
  const [row] = await db
    .select({ version: msgpackrMigrationTable.version })
    .from(msgpackrMigrationTable)
    .where(
      and(
        eq(msgpackrMigrationTable.tablename, table),
        eq(msgpackrMigrationTable.columnname, column),
      ),
    );

  return row?.version ?? 0;
}

async function setDbVersion(table: string, column: string, version: number): Promise<void> {
  await db
    .insert(msgpackrMigrationTable)
    .values({ tablename: table, columnname: column, version })
    .onConflictDoUpdate({
      target: [msgpackrMigrationTable.tablename, msgpackrMigrationTable.columnname],
      set: { version },
    });
}

async function migrateTable(migration: Migration): Promise<void> {
  const table = migration.table;
  const column = migration.column as string;
  const version = migration.version;

  const dbVersion = await getDbVersion(table, column);
  const encoding =
    columnEncodings[table][migration.column as keyof (typeof columnEncodings)[typeof table]];

  if (encoding !== "msgpackr") {
    log.warn({ table, column, encoding }, "Skipping migration: unsupported encoding");
    return;
  }

  if (version <= dbVersion) {
    log.debug({ table, column, dbVersion }, "Migration already applied");
    return;
  }

  if (version !== dbVersion + 1) {
    log.warn(
      {
        table,
        column,
        dbVersion,
        migrationVersion: version,
      },
      "Skipping migration: version gap detected",
    );
    return;
  }

  log.info(
    {
      table,
      column,
      fromVersion: dbVersion,
      toVersion: version,
    },
    "Applying migration",
  );

  const tableSchema = tableSchemaRegistry[table];
  if (!tableSchema) {
    throw new Error(`Table ${table} not found in registry`);
  }

  const idColumn = tableSchema.id;
  const columnAccessor = tableSchema[column as keyof typeof tableSchema];

  if (!idColumn || !columnAccessor) {
    throw new Error(`Column ${column} not found in table ${table}`);
  }

  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const rows = await db
      .select({ id: idColumn, data: columnAccessor })
      .from(tableSchema)
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.data) continue;

      const oldData = unpack(row.data as Uint8Array);
      const newData = applyMigration(migration, oldData);

      if (newData !== oldData) {
        await db
          .update(tableSchema)
          .set({ [column]: pack(newData) } as any)
          .where(eq(idColumn, row.id));
      }
    }

    offset += BATCH_SIZE;
    log.debug({ table, processed: offset }, "Migration batch complete");
  }

  await setDbVersion(table, column, version);
  log.info({ table, column, newVersion: version }, "Migration complete");
}

export async function runMsgpackrMigrations(migrations: Migration[]): Promise<void> {
  if (migrations.length === 0) {
    log.debug("No migrations to run");
    return;
  }

  log.info({ count: migrations.length }, "Starting blob migrations");

  const hasLease = await acquireLease();
  if (!hasLease) {
    log.info("Skipping migrations: another instance holds the lease");
    return;
  }

  try {
    for (const migration of migrations) {
      await migrateTable(migration);
    }
  } finally {
    await releaseLease();
  }

  log.info("All blob migrations complete");
}
