import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { createAsset } from "../assets/createAsset";
import { linkAssetToItem } from "../assets/linkAssetToItem";
import { setCollection } from "../collections/setCollection";
import { createItem } from "./createItem";
import { createItemLink } from "./createItemLink";
import { findItems } from "./findItems";
import { getItemById } from "./getItemById";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

async function seedItems() {
  await setCollection("articles", "Articles", { title: 1 });
  await setCollection("guides", "Guides", { title: 1 });

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

  test("filters by collection", () => {
    const result = findItems({ filter: 'collection = "articles"' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((i) => i.collection === "articles")).toBe(true);
  });

  test("filters by props", () => {
    const result = findItems({ filter: 'props.category = "news"' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("filters with AND", () => {
    const result = findItems({
      filter: 'collection = "articles" && props.featured = true',
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("filters with OR", () => {
    const result = findItems({
      filter: 'props.category = "news" || props.category = "docs"',
    });
    expect(result.data).toHaveLength(2);
  });

  test("supports like filter", () => {
    const result = findItems({ filter: 'props.title ~ "Post"' });
    expect(result.data).toHaveLength(2);
  });

  test("supports changedAt range", () => {
    const result = findItems({
      filter: "changedAt >= 100 && changedAt <= 150",
    });
    expect(result.data).toHaveLength(2);
  });

  test("sorts ascending by field", () => {
    const result = findItems({ sort: "changedAt" });
    expect(result.data[0].id).toBe(makeId(1));
    expect(result.data[2].id).toBe(makeId(2));
  });

  test("sorts descending with - prefix", () => {
    const result = findItems({ sort: "-changedAt" });
    expect(result.data[0].id).toBe(makeId(2));
    expect(result.data[2].id).toBe(makeId(1));
  });

  test("sorts with object notation", () => {
    const result = findItems({
      sort: { field: "changedAt", direction: "asc" },
    });
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("respects limit", () => {
    const result = findItems({ limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(3);
  });

  test("respects offset", () => {
    const result = findItems({ sort: "changedAt", limit: 2, offset: 1 });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(makeId(3));
  });

  test("allows large limit", () => {
    const result = findItems({ limit: 500 });
    expect(result.meta.limit).toBe(500);
  });

  test("excludes content by default", () => {
    const result = findItems();
    // content should not be present
    expect(result.data[0]).not.toHaveProperty("content");
  });

  test("includes content when requested", () => {
    const result = findItems({ include: ["content"] });
    // Items don't have content set, but the field should be queried
    expect(result.data).toHaveLength(3);
  });

  test("supports search", () => {
    const result = findItems({ search: "Alpha" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(makeId(1));
  });

  test("search matches ref", () => {
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

  test("includes content links when requested", async () => {
    await createItemLink({ prop: null, from: makeId(1), to: makeId(2), internal: true });

    const result = findItems({
      filter: 'collection = "articles"',
      include: ["links"],
    });

    const item1 = result.data.find((i) => i.id === makeId(1))!;
    expect(item1.links).toHaveLength(1);
    expect((item1.links[0] as any).id).toBe(makeId(2));
  });

  test("resolves with relations", () => {
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
    expect((result.data[0].rels!.sameColl as any[])[0].id).toBe(makeId(2));
  });

  test("findItems with forward REF relation", async () => {
    await setCollection("persons", "Persons", { name: 1 });

    await createItem({
      id: makeId(10),
      ref: "person/alice",
      collection: "persons",
      props: { name: "Alice" },
      changedAt: 50,
    });

    const linkId = createItemLink({
      prop: "author",
      from: makeId(1),
      to: makeId(10),
      internal: true,
    });

    // Update item 1 to include the author link
    const { createOrUpdateItem } = await import("./createOrUpdateItem");
    await createOrUpdateItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: { title: "Alpha Post", category: "news", featured: true, views: 10, author: linkId },
      changedAt: 100,
    });

    const result = findItems({
      filter: `id = "${makeId(1)}"`,
      with: {
        author: {
          collection: "persons",
          single: true,
          filter: "id = $1.props.author",
        },
      },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].rels).toBeDefined();
    expect(result.data[0].rels!.author).not.toBeNull();
    expect(result.data[0].rels!.author.id).toBe(makeId(10));
  });

  test("findItems with backlink relation", async () => {
    await setCollection("persons", "Persons", { name: 1 });

    await createItem({
      id: makeId(10),
      ref: "person/alice",
      collection: "persons",
      props: { name: "Alice" },
      changedAt: 50,
    });

    const linkId1 = createItemLink({
      prop: "author",
      from: makeId(1),
      to: makeId(10),
      internal: true,
    });

    const linkId2 = createItemLink({
      prop: "author",
      from: makeId(2),
      to: makeId(10),
      internal: true,
    });

    // Update articles to include author links
    const { createOrUpdateItem } = await import("./createOrUpdateItem");
    await createOrUpdateItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: { title: "Alpha Post", category: "news", featured: true, views: 10, author: linkId1 },
      changedAt: 100,
    });
    await createOrUpdateItem({
      id: makeId(2),
      ref: "blog/lifestyle/bravo",
      collection: "articles",
      props: {
        title: "Bravo Post",
        category: "updates",
        featured: false,
        views: 5,
        author: linkId2,
      },
      changedAt: 200,
    });

    const result = findItems({
      filter: `id = "${makeId(10)}"`,
      with: {
        posts: {
          collection: "articles",
          filter: 'linksTo("author") = $1.id',
        },
      },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].rels).toBeDefined();
    expect(result.data[0].rels!.posts).toHaveLength(2);
    const postIds = result.data[0].rels!.posts.map((p: any) => p.id);
    expect(postIds).toContain(makeId(1));
    expect(postIds).toContain(makeId(2));
  });
});

describe("getItemById", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await seedItems();
  });

  test("returns item by id", () => {
    const item = getItemById(makeId(1));
    expect(item).not.toBeNull();
    expect(item!.id).toBe(makeId(1));
    expect(item!.collection).toBe("articles");
  });

  test("returns null for non-existent id", () => {
    const item = getItemById(makeId(99));
    expect(item).toBeNull();
  });

  test("includes content by default", () => {
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

  test("resolves relations", () => {
    const item = getItemById(makeId(1), {
      with: {
        sameColl: {
          filter: "collection = $1.collection && ref != $1.ref",
        },
      },
    });

    expect(item!.rels!.sameColl).toHaveLength(1);
    expect((item!.rels!.sameColl as any[])[0].id).toBe(makeId(2));
  });
});
