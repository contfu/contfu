import { describe, expect, test } from "bun:test";
import { collectionsTable } from "./schema";
import { createBunDatabaseClient } from "./db-bun";
import { buildDrizzleMigrations } from "./db-shared";
import { migrations } from "./generated-migrations";

describe("generated migrations", () => {
  test("derive Drizzle migrations from embedded SQL", () => {
    const drizzleMigrations = buildDrizzleMigrations(migrations);

    expect(drizzleMigrations).toHaveLength(1);
    expect(drizzleMigrations[0]?.name).toBe("20260311074508_init");
    expect(drizzleMigrations[0]?.sql.length).toBeGreaterThan(1);
  });

  test("apply embedded migrations when creating a database", async () => {
    const db = await createBunDatabaseClient(":memory:");

    db.insert(collectionsTable)
      .values({
        name: "articles",
        displayName: "Articles",
        schema: {},
      })
      .run();

    const rows = db.select().from(collectionsTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("articles");
  });
});
