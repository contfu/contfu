import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import { createItem } from "./createItem";
import { queryItems } from "./queryItems";

function seedItems() {
  setCollection("articles", "Articles", { title: 1 });
  setCollection("guides", "Guides", { title: 1 });

  createItem({
    id: 1,
    ref: "article/alpha",
    collection: "articles",
    props: { title: "Alpha", featured: true, views: 10, category: "news" },
    changedAt: 100,
  });

  createItem({
    id: 2,
    ref: "article/bravo",
    collection: "articles",
    props: { title: "Bravo", featured: false, views: 5, category: "updates" },
    changedAt: 200,
  });

  createItem({
    id: 3,
    ref: "guide/charlie",
    collection: "guides",
    props: { title: "Charlie", featured: true, views: 7, category: "docs" },
    changedAt: 150,
  });
}

describe("queryItems", () => {
  beforeEach(() => {
    truncateAllTables();
    seedItems();
  });

  test("filters by collection", () => {
    const result = queryItems({ collection: "articles" });
    expect(result.items).toHaveLength(2);
    expect(new Set(result.items.map((i) => i.collection))).toEqual(new Set(["articles"]));
  });

  test("filters by inclusive changedAt range", () => {
    const result = queryItems({ changedAtFrom: 100, changedAtTo: 150, sortDirection: "asc" });
    expect(result.items.map((i) => i.id)).toEqual([1, 3]);
  });

  test("supports prop eq filter", () => {
    const result = queryItems({
      propFilters: [{ key: "featured", op: "eq", value: true }],
      sortField: "collection",
      sortDirection: "asc",
    });

    expect(result.items.map((i) => i.id)).toEqual([1, 3]);
  });

  test("supports prop contains filter on string values only", () => {
    const result = queryItems({
      propFilters: [{ key: "category", op: "contains", value: "up" }],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(2);
  });

  test("combines prop filters with AND", () => {
    const result = queryItems({
      propFilters: [
        { key: "featured", op: "eq", value: true },
        { key: "category", op: "contains", value: "doc" },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(3);
  });

  test("sorts with stable ref tiebreaker", () => {
    createItem({
      id: 4,
      ref: "article/able",
      collection: "articles",
      props: { title: "Able" },
      changedAt: 200,
    });

    const result = queryItems({ sortField: "changedAt", sortDirection: "desc" });
    expect(result.items.slice(0, 2).map((i) => i.id)).toEqual([2, 4]);
  });

  test("supports pagination and meta", () => {
    for (let idx = 4; idx <= 12; idx++) {
      createItem({
        id: idx,
        ref: `extra/${idx}`,
        collection: "guides",
        props: { title: `Extra ${idx}` },
        changedAt: 200 + idx,
      });
    }

    const result = queryItems({
      page: 2,
      pageSize: 10,
      sortField: "changedAt",
      sortDirection: "asc",
    });
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe(11);
  });

  test("returns empty items when page is out of range", () => {
    const result = queryItems({ page: 9, pageSize: 10 });
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(0);
  });
});
