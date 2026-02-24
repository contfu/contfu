import { beforeEach, describe, expect, test } from "bun:test";
import { createItem } from "../../features/items/createItem";
import { db } from "../db/db";
import { itemsTable } from "../db/schema";
import { truncateAllTables } from "../../../test/setup";
import { compileFilter } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { encodeId } from "../ids";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

function filter(expr: string) {
  return compileFilter(parse(tokenize(expr)));
}

async function queryWithFilter(expr: string) {
  const where = filter(expr);
  const rows = await db.select().from(itemsTable).where(where).all();
  return rows.map((r) => encodeId(r.id));
}

describe("compileFilter", () => {
  beforeEach(async () => {
    await truncateAllTables();

    await createItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: {
        title: "Alpha Post",
        category: "news",
        featured: true,
        views: 10,
        tags: ["tech", "ai"],
      },
      changedAt: 100,
    });

    await createItem({
      id: makeId(2),
      ref: "blog/lifestyle/bravo",
      collection: "articles",
      props: {
        title: "Bravo Post",
        category: "updates",
        featured: false,
        views: 5,
        tags: ["health"],
      },
      changedAt: 200,
    });

    await createItem({
      id: makeId(3),
      ref: "guides/charlie",
      collection: "guides",
      props: { title: "Charlie Guide", category: "docs", featured: true, views: 7 },
      changedAt: 150,
    });
  });

  test("filters by direct column (collection)", async () => {
    const ids = await queryWithFilter('collection = "articles"');
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(2));
  });

  test("filters by changedAt range", async () => {
    const ids = await queryWithFilter("changedAt >= 100 && changedAt <= 150");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(3));
  });

  test("filters by props (json_extract)", async () => {
    const ids = await queryWithFilter('props.category = "news"');
    expect(ids).toEqual([makeId(1)]);
  });

  test("filters with like operator", async () => {
    const ids = await queryWithFilter('props.title ~ "Post"');
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(2));
  });

  test("filters with not-like operator", async () => {
    const ids = await queryWithFilter('props.title !~ "Post"');
    expect(ids).toEqual([makeId(3)]);
  });

  test("filters with boolean props", async () => {
    const ids = await queryWithFilter("props.featured = true");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(3));
  });

  test("filters with numeric comparison on props", async () => {
    const ids = await queryWithFilter("props.views > 7");
    expect(ids).toEqual([makeId(1)]);
  });

  test("filters with OR", async () => {
    const ids = await queryWithFilter('collection = "articles" || collection = "guides"');
    expect(ids).toHaveLength(3);
  });

  test("filters with AND + OR grouping", async () => {
    const ids = await queryWithFilter(
      '(props.category = "news" || props.category = "docs") && props.featured = true',
    );
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(3));
  });

  test("filters with != null", async () => {
    const ids = await queryWithFilter("ref != null");
    expect(ids).toHaveLength(3);
  });

  test("filters with = null", async () => {
    const ids = await queryWithFilter("ref = null");
    expect(ids).toHaveLength(0);
  });

  test("filters by ref", async () => {
    const ids = await queryWithFilter('ref = "blog/tech/alpha"');
    expect(ids).toEqual([makeId(1)]);
  });

  test("filters with array contains (?=)", async () => {
    const ids = await queryWithFilter('props.tags ?= "tech"');
    expect(ids).toEqual([makeId(1)]);
  });

  test("filters with depth() function", async () => {
    // "blog/tech/alpha" has depth 3, "blog/lifestyle/bravo" has depth 3, "guides/charlie" has depth 2
    const ids = await queryWithFilter("depth(ref) = 3");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(makeId(1));
    expect(ids).toContain(makeId(2));
  });

  test("throws on unknown function", () => {
    expect(() => filter("unknown(ref) = 1")).toThrow("Unknown function");
  });
});
