import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { createItem } from "./createItem";
import { deleteItem } from "./deleteItem";
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

  test("preserves Unicode case-insensitive contains semantics", () => {
    createItem({
      id: 4,
      ref: "article/unicode",
      collection: "articles",
      props: { title: "ÄBC" },
      changedAt: 250,
    });

    expect(
      queryItems({ propFilters: [{ key: "title", op: "contains", value: "ä" }] }).items.map(
        (item) => item.id,
      ),
    ).toEqual([4]);
  });

  test("preserves locale-aware collection ordering", () => {
    setCollection("Älpha", "Älpha", { title: 1 });
    setCollection("alpha", "alpha", { title: 1 });
    setCollection("Beta", "Beta", { title: 1 });
    createItem({ id: 4, ref: "Älpha/item", collection: "Älpha", props: {}, changedAt: 250 });
    createItem({ id: 5, ref: "alpha/item", collection: "alpha", props: {}, changedAt: 251 });
    createItem({ id: 6, ref: "Beta/item", collection: "Beta", props: {}, changedAt: 252 });

    expect(
      queryItems({ sortField: "collection", sortDirection: "asc" }).items.map((i) => i.id),
    ).toEqual([5, 4, 1, 2, 6, 3]);
  });

  test("rejects malformed property filters without throwing", () => {
    const result = queryItems({
      propFilters: [{ key: null, op: "contains", value: "x" }] as never,
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("matches synthetic locale and treats contains wildcards literally", () => {
    createItem({
      id: 4,
      ref: "article/wildcard",
      collection: "articles",
      props: { title: "100%_ready", $locale: "en-US" },
      changedAt: 250,
    });

    expect(
      queryItems({ propFilters: [{ key: "$locale", op: "eq", value: "en-US" }] }).items.map(
        (item) => item.id,
      ),
    ).toEqual([4]);
    expect(
      queryItems({ propFilters: [{ key: "title", op: "contains", value: "%_" }] }).items.map(
        (item) => item.id,
      ),
    ).toEqual([4]);
    expect(queryItems({ propFilters: [{ key: "views", op: "eq", value: 10 }] }).items).toHaveLength(
      1,
    );
    expect(
      queryItems({ propFilters: [{ key: "featured", op: "eq", value: true }] }).items,
    ).toHaveLength(2);
  });

  test("filters soft-deleted items by default and can include or select them", () => {
    deleteItem(2);

    const active = queryItems({ sortDirection: "asc" });
    expect(active.items.map((item) => item.id)).toEqual([1, 3]);
    expect(active.total).toBe(2);

    const withDeleted = queryItems({ includeDeleted: true, sortDirection: "asc" });
    expect(withDeleted.items.map((item) => item.id)).toEqual([1, 3, 2]);
    expect(withDeleted.items.find((item) => item.id === 2)?.deletedAt).toBeNumber();

    const deleted = queryItems({ onlyDeleted: true });
    expect(deleted.items.map((item) => item.id)).toEqual([2]);
    expect(deleted.total).toBe(1);
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

  test("bounds page work for a 10,000-item collection", () => {
    setCollection("large", "Large", { title: 1 });
    for (let offset = 0; offset < 10_000; offset += 500) {
      db.insert(itemsTable)
        .values(
          Array.from({ length: 500 }, (_, index) => ({
            id: 10_000 + offset + index,
            collection: "large",
            props: { title: `Item ${offset + index}` },
            locale: null,
            content: null,
            changedAt: offset + index,
            deletedAt: null,
          })),
        )
        .run();
    }

    const statements: { sql: string; method: string; rowCount: number }[] = [];
    const wrapBuilder = (builder: any): any =>
      new Proxy(builder, {
        get(target, property, receiver) {
          const member = Reflect.get(target, property, receiver);
          if (property === "get" || property === "all") {
            return (...args: any[]) => {
              const result = member.apply(target, args);
              statements.push({
                sql: target.toSQL().sql,
                method: String(property),
                rowCount: Array.isArray(result) ? result.length : 1,
              });
              return result;
            };
          }
          if (typeof member === "function") {
            return (...args: any[]) => wrapBuilder(member.apply(target, args));
          }
          return member;
        },
      });
    const observedDb = new Proxy(db, {
      get(target, property, receiver) {
        const member = Reflect.get(target, property, receiver);
        if (property === "select") return (...args: any[]) => wrapBuilder(member(...args));
        return member;
      },
    });

    const result = queryItems(
      {
        collection: "large",
        page: 2,
        pageSize: 10,
        sortDirection: "asc",
      },
      observedDb,
    );
    expect(statements).toHaveLength(2);
    expect(statements[0]?.method).toBe("get");
    expect(statements[0]?.sql).toContain("count(");
    expect(statements[0]?.sql).not.toContain('"props"');
    expect(statements[1]?.method).toBe("all");
    expect(statements[1]?.sql).toMatch(/limit .*offset/i);
    expect(statements[1]?.rowCount).toBe(10);
    expect(result.total).toBe(10_000);
    expect(result.items).toHaveLength(10);
    expect(result.items.map((item) => item.id)).toEqual([
      10_010, 10_011, 10_012, 10_013, 10_014, 10_015, 10_016, 10_017, 10_018, 10_019,
    ]);
  });
});
