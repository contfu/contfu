import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";
import { setSyncIndex } from "./setSyncIndex";

describe("setSyncIndex", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  test("inserts row when sync table is empty", async () => {
    await setSyncIndex(42);

    const rows = await db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(42);
  });

  test("updates existing row when sync table has a row", async () => {
    await db.insert(syncTable).values({ index: 10 }).run();
    await setSyncIndex(99);

    const rows = await db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(99);
  });
});
