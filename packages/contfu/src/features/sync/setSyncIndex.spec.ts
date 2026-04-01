import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";
import { setSyncIndex } from "./setSyncIndex";

describe("setSyncIndex", () => {
  beforeEach(() => {
    truncateAllTables();
  });

  test("inserts row when sync table is empty", () => {
    setSyncIndex(42);

    const rows = db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(42);
  });

  test("updates existing row when sync table has a row", () => {
    db.insert(syncTable).values({ index: 10 }).run();
    setSyncIndex(99);

    const rows = db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(99);
  });
});
