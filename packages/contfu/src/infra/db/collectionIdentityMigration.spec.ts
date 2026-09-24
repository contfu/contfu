import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { runEmbeddedMigrations, type DrizzleMigrationExecutor } from "./db-shared";
import { migrations } from "./generated-migrations";
import { createDatabaseClient } from "./db";
import { collectionsTable, itemsTable, syncTable } from "./schema";
import { createOrUpdateItem } from "../../features/items/createOrUpdateItem";
import { getItemById } from "../../features/items/getItemById";

describe("collection identity cache cutover", () => {
  test("resets only synchronized data and replays duplicate numeric IDs durably", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contfu-scoped-"));
    const path = join(dir, "cache.sqlite");
    try {
      const legacy = new Database(path);
      legacy.run("PRAGMA foreign_keys = ON");
      runEmbeddedMigrations(
        drizzle({ client: legacy }) as unknown as DrizzleMigrationExecutor,
        migrations.filter((migration) => migration.timestamp < 20260912000000),
      );
      legacy.run("CREATE TABLE user_config (value TEXT NOT NULL)");
      legacy.run("INSERT INTO user_config VALUES ('keep me')");
      legacy.run(
        "INSERT INTO collections (name, displayName, schema) VALUES ('legacy', 'Legacy', '{}')",
      );
      legacy.run("INSERT INTO items (id, collection, changedAt) VALUES (30, 'legacy', 1)");
      legacy.run('INSERT INTO sync ("index") VALUES (123)');
      legacy.close();

      const db = await createDatabaseClient(path);
      expect(db.select().from(itemsTable).all()).toEqual([]);
      expect(db.select().from(collectionsTable).all()).toEqual([]);
      expect(db.select().from(syncTable).all()).toEqual([]);
      const inspect = new Database(path, { readonly: true });
      expect(inspect.query("SELECT value FROM user_config").get()).toEqual({ value: "keep me" });
      inspect.close();
      db.insert(collectionsTable)
        .values([
          { name: "first", displayName: "First", schema: {} },
          { name: "second", displayName: "Second", schema: {} },
        ])
        .run();
      for (const collection of ["first", "second"]) {
        createOrUpdateItem({ id: 30, collection, changedAt: 1, props: { title: "Created" } }, db);
        createOrUpdateItem(
          { id: 30, collection, changedAt: 2, props: { title: "Native edit" } },
          db,
        );
      }
      const reconnected = await createDatabaseClient(path);
      for (const collection of ["first", "second"]) {
        expect(getItemById([collection, 30], undefined, reconnected)).toMatchObject({
          $id: [collection, 30],
          title: "Native edit",
        });
      }
      expect(reconnected.select().from(itemsTable).all()).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
