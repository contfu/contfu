import { beforeEach, describe, expect, test } from "bun:test";
import { createItem } from "./createItem";
import { queryItems } from "./queryItems";
import { truncateAllTables } from "../../../test/setup";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

async function seedItems() {
  await createItem({
    id: makeId(1),
    ref: "article/alpha",
    collection: "articles",
    props: { title: "Alpha", featured: true, views: 10, category: "news" },
    changedAt: 100,
  });

  await createItem({
    id: makeId(2),
    ref: "article/bravo",
    collection: "articles",
    props: { title: "Bravo", featured: false, views: 5, category: "updates" },
    changedAt: 200,
  });

  await createItem({
    id: makeId(3),
    ref: "guide/charlie",
    collection: "guides",
    props: { title: "Charlie", featured: true, views: 7, category: "docs" },
    changedAt: 150,
  });
}

describe("queryItems", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await seedItems();
  });

  test("filters by collection", async () => {
    const result = await queryItems({ collection: "articles" });
    expect(result.items).toHaveLength(2);
    expect(new Set(result.items.map((i) => i.collection))).toEqual(new Set(["articles"]));
  });

  test("filters by search in ref", async () => {
    const result = await queryItems({ search: "brav" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.ref).toBe("article/bravo");
  });

  test("filters by inclusive changedAt range", async () => {
    const result = await queryItems({ changedAtFrom: 100, changedAtTo: 150, sortDirection: "asc" });
    expect(result.items.map((i) => i.ref)).toEqual(["article/alpha", "guide/charlie"]);
  });

  test("supports prop eq filter", async () => {
    const result = await queryItems({
      propFilters: [{ key: "featured", op: "eq", value: true }],
      sortField: "ref",
      sortDirection: "asc",
    });

    expect(result.items.map((i) => i.ref)).toEqual(["article/alpha", "guide/charlie"]);
  });

  test("supports prop contains filter on string values only", async () => {
    const result = await queryItems({
      propFilters: [{ key: "category", op: "contains", value: "up" }],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.ref).toBe("article/bravo");
  });

  test("combines prop filters with AND", async () => {
    const result = await queryItems({
      propFilters: [
        { key: "featured", op: "eq", value: true },
        { key: "category", op: "contains", value: "doc" },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.ref).toBe("guide/charlie");
  });

  test("sorts with stable ref tiebreaker", async () => {
    await createItem({
      id: makeId(4),
      ref: "article/able",
      collection: "articles",
      props: { title: "Able" },
      changedAt: 200,
    });

    const result = await queryItems({ sortField: "changedAt", sortDirection: "desc" });
    expect(result.items.slice(0, 2).map((i) => i.ref)).toEqual(["article/able", "article/bravo"]);
  });

  test("supports pagination and meta", async () => {
    for (let idx = 4; idx <= 12; idx++) {
      await createItem({
        id: makeId(idx),
        ref: `extra/${idx}`,
        collection: "guides",
        props: { title: `Extra ${idx}` },
        changedAt: 200 + idx,
      });
    }

    const result = await queryItems({ page: 2, pageSize: 10, sortField: "ref", sortDirection: "asc" });
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.ref).toBe("extra/9");
  });

  test("returns empty items when page is out of range", async () => {
    const result = await queryItems({ page: 9, pageSize: 10 });
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(0);
  });
});
