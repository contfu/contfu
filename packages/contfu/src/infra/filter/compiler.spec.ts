import { beforeEach, describe, expect, test } from "bun:test";
import { setCollection } from "../../features/collections/setCollection";
import { createItem } from "../../features/items/createItem";
import { db } from "../db/db";
import { itemsTable } from "../db/schema";
import { truncateAllTables } from "../../../test/setup";
import { compileFilter } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
function filter(expr: string) {
  return compileFilter(parse(tokenize(expr)));
}

function queryWithFilter(expr: string) {
  const where = filter(expr);
  const rows = db.select({ id: itemsTable.id }).from(itemsTable).where(where).all();
  return rows.map((r) => r.id);
}

describe("compileFilter", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("articles", "Articles", {});
    setCollection("guides", "Guides", {});

    createItem({
      id: 1,
      ref: "blog/tech/alpha",
      collection: "articles",
      props: {
        title: "Alpha Post",
        category: "news",
        featured: true,
        views: 10,
        tags: ["tech", "ai"],
        path: "blog/tech/alpha",
      },
      changedAt: 100,
    });

    createItem({
      id: 2,
      ref: "blog/lifestyle/bravo",
      collection: "articles",
      props: {
        title: "Bravo Post",
        category: "updates",
        featured: false,
        views: 5,
        tags: ["health"],
        path: "blog/lifestyle/bravo",
      },
      changedAt: 200,
    });

    createItem({
      id: 3,
      ref: "guides/charlie",
      collection: "guides",
      props: {
        title: "Charlie Guide",
        category: "docs",
        featured: true,
        views: 7,
        path: "guides/charlie",
      },
      changedAt: 150,
    });
  });

  test("filters by direct column (collection)", () => {
    const ids = queryWithFilter('$collection = "articles"');
    expect(ids).toHaveLength(2);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  test("filters by changedAt range", () => {
    const ids = queryWithFilter("$changedAt >= 100 && $changedAt <= 150");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
  });

  test("filters by props (json_extract)", () => {
    const ids = queryWithFilter('category = "news"');
    expect(ids).toEqual([1]);
  });

  test("filters with like operator", () => {
    const ids = queryWithFilter('title ~ "Post"');
    expect(ids).toHaveLength(2);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  test("filters with not-like operator", () => {
    const ids = queryWithFilter('title !~ "Post"');
    expect(ids).toEqual([3]);
  });

  test("filters with boolean props", () => {
    const ids = queryWithFilter("featured = true");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
  });

  test("filters with numeric comparison on props", () => {
    const ids = queryWithFilter("views > 7");
    expect(ids).toEqual([1]);
  });

  test("filters with OR", () => {
    const ids = queryWithFilter('$collection = "articles" || $collection = "guides"');
    expect(ids).toHaveLength(3);
  });

  test("filters with AND + OR grouping", () => {
    const ids = queryWithFilter('(category = "news" || category = "docs") && featured = true');
    expect(ids).toHaveLength(2);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
  });

  test("filters with != null", () => {
    const ids = queryWithFilter("path != null");
    expect(ids).toHaveLength(3);
  });

  test("filters with = null", () => {
    const ids = queryWithFilter("missing = null");
    expect(ids).toHaveLength(3);
  });

  test("filters by modeled path", () => {
    const ids = queryWithFilter('path = "blog/tech/alpha"');
    expect(ids).toEqual([1]);
  });

  test("filters with depth() function", () => {
    const ids = queryWithFilter("depth(path) = 3");
    expect(ids).toHaveLength(2);
  });

  test("filters with array contains (?=)", () => {
    const ids = queryWithFilter('tags ?= "tech"');
    expect(ids).toEqual([1]);
  });

  test("filters by id (blob comparison)", () => {
    const ids = queryWithFilter(`$id = "${1}"`);
    expect(ids).toEqual([1]);
  });

  test("filters by id excludes non-matching", () => {
    const ids = queryWithFilter(`$id = "${99}"`);
    expect(ids).toEqual([]);
  });

  test("throws on unknown function", () => {
    expect(() => filter("unknown($id) = 1")).toThrow("Unknown function");
  });
});
