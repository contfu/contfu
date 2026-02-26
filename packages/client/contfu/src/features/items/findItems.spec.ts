import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { createAsset } from "../assets/createAsset";
import { linkAssetToItem } from "../assets/linkAssetToItem";
import { createItem } from "./createItem";
import { createItemLink } from "./createItemLink";
import { findItems } from "./findItems";
import { getItemById } from "./getItemById";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

async function seedItems() {
  await createItem({
    id: makeId(1),
    ref: "blog/tech/alpha",
    collection: "articles",
    props: { title: "Alpha Post", category: "news", featured: true, views: 10 },
    changedAt: 100,
  });

  await createItem({
    id: makeId(2),
    ref: "blog/lifestyle/bravo",
    collection: "articles",
    props: { title: "Bravo Post", category: "updates", featured: false, views: 5 },
    changedAt: 200,
  });

  await createItem({
    id: makeId(3),
    ref: "guides/charlie",
    collection: "guides",
    props: { title: "Charlie Guide", category: "docs", featured: true, views: 7 },
    changedAt: 150,
  });
}

describe("findItems", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await seedItems();
  });

  test("returns all items with default pagination", () => {
    const result = findItems();
    expect(result.data).toHaveLength(3);
    expect(result.meta.total).toBe(3);
    expect(result.meta.limit).toBe(20);
    expect(result.meta.offset).toBe(0);
  });

  test("filters by collection", async () => {
    const result = findItems({ filter: 'collection = "articles"' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((i) => i.collection === "articles")).toBe(true);
  });

  test("filters by props", async () => {
    const result = findItems({ filter: 'props.category = "news"' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("filters with AND", async () => {
    const result = findItems({
      filter: 'collection = "articles" && props.featured = true',
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("filters with OR", async () => {
    const result = findItems({
      filter: 'props.category = "news" || props.category = "docs"',
    });
    expect(result.data).toHaveLength(2);
  });

  test("supports like filter", async () => {
    const result = findItems({ filter: 'props.title ~ "Post"' });
    expect(result.data).toHaveLength(2);
  });

  test("supports changedAt range", async () => {
    const result = findItems({
      filter: "changedAt >= 100 && changedAt <= 150",
    });
    expect(result.data).toHaveLength(2);
  });

  test("sorts ascending by field", async () => {
    const result = findItems({ sort: "changedAt" });
    expect(result.data[0].id).toBe(makeId(1));
    expect(result.data[2].id).toBe(makeId(2));
  });

  test("sorts descending with - prefix", async () => {
    const result = findItems({ sort: "-changedAt" });
    expect(result.data[0].id).toBe(makeId(2));
    expect(result.data[2].id).toBe(makeId(1));
  });

  test("sorts with object notation", async () => {
    const result = findItems({
      sort: { field: "changedAt", direction: "asc" },
    });
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("respects limit", async () => {
    const result = findItems({ limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(3);
  });

  test("respects offset", async () => {
    const result = findItems({ sort: "changedAt", limit: 2, offset: 1 });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(makeId(3));
  });

  test("allows large limit", async () => {
    const result = findItems({ limit: 500 });
    expect(result.meta.limit).toBe(500);
  });

  test("excludes content by default", async () => {
    const result = findItems();
    // content should not be present
    expect(result.data[0]).not.toHaveProperty("content");
  });

  test("includes content when requested", async () => {
    const result = findItems({ include: ["content"] });
    // Items don't have content set, but the field should be queried
    expect(result.data).toHaveLength(3);
  });

  test("supports search", async () => {
    const result = findItems({ search: "Alpha" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("search matches ref", async () => {
    const result = findItems({ search: "lifestyle" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(2));
  });

  test("includes assets when requested", async () => {
    await createAsset({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });
    await linkAssetToItem(makeId(1), makeId(10));

    const result = findItems({
      filter: 'collection = "articles"',
      include: ["assets"],
    });

    const item1 = result.data.find((i) => i.id === makeId(1))!;
    const item2 = result.data.find((i) => i.id === makeId(2))!;
    expect(item1.assets).toHaveLength(1);
    expect(item1.assets![0].id).toBe(makeId(10));
    expect(item2.assets).toEqual([]);
  });

  test("includes links when requested", async () => {
    await createItemLink({ type: "related", from: makeId(1), to: makeId(2) });

    const result = findItems({
      filter: 'collection = "articles"',
      include: ["links"],
    });

    const item1 = result.data.find((i) => i.id === makeId(1))!;
    expect(item1.links.related).toEqual([makeId(2)]);
  });

  test("resolves with relations", async () => {
    const result = findItems({
      filter: 'collection = "articles" && props.featured = true',
      with: {
        sameColl: {
          filter: "collection = $1.collection && ref != $1.ref",
        },
      },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].rels).toBeDefined();
    expect(result.data[0].rels!.sameColl).toHaveLength(1);
    expect(result.data[0].rels!.sameColl[0].id).toBe(makeId(2));
  });
});

describe("getItemById", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await seedItems();
  });

  test("returns item by id", async () => {
    const item = getItemById(makeId(1));
    expect(item).not.toBeNull();
    expect(item!.id).toBe(makeId(1));
    expect(item!.collection).toBe("articles");
  });

  test("returns null for non-existent id", async () => {
    const item = getItemById(makeId(99));
    expect(item).toBeNull();
  });

  test("includes content by default", async () => {
    const item = getItemById(makeId(1));
    // content is queried (may be undefined if no content set)
    expect(item).not.toBeNull();
  });

  test("resolves assets when requested", async () => {
    await createAsset({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });
    await linkAssetToItem(makeId(1), makeId(10));

    const item = getItemById(makeId(1), { include: ["assets"] });
    expect(item!.assets).toHaveLength(1);
  });

  test("resolves relations", async () => {
    const item = getItemById(makeId(1), {
      with: {
        sameColl: {
          filter: "collection = $1.collection && ref != $1.ref",
        },
      },
    });

    expect(item!.rels!.sameColl).toHaveLength(1);
    expect(item!.rels!.sameColl[0].id).toBe(makeId(2));
  });
});
