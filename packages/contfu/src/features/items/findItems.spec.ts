import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { createFile } from "../files/createFile";
import { linkFileToItem } from "../files/linkFileToItem";
import { setCollection } from "../collections/setCollection";
import { createItem } from "./createItem";
import { createItemLink } from "./createItemLink";
import { findItems } from "./findItems";
import { getItemById } from "./getItemById";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

function seedItems() {
  setCollection("articles", "Articles", { title: 1 });
  setCollection("guides", "Guides", { title: 1 });

  createItem({
    id: makeId(1),
    ref: "blog/tech/alpha",
    collection: "articles",
    props: { title: "Alpha Post", category: "news", featured: true, views: 10 },
    changedAt: 100,
  });

  createItem({
    id: makeId(2),
    ref: "blog/lifestyle/bravo",
    collection: "articles",
    props: { title: "Bravo Post", category: "updates", featured: false, views: 5 },
    changedAt: 200,
  });

  createItem({
    id: makeId(3),
    ref: "guides/charlie",
    collection: "guides",
    props: { title: "Charlie Guide", category: "docs", featured: true, views: 7 },
    changedAt: 150,
  });
}

describe("findItems", () => {
  beforeEach(() => {
    truncateAllTables();
    seedItems();
  });

  test("returns all items with default pagination", () => {
    const result = findItems();
    expect(result).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  test("filters by collection", () => {
    const result = findItems({ filter: '$collection = "articles"' });
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.$collection === "articles")).toBe(true);
  });

  test("filters by props", () => {
    const result = findItems({ filter: 'category = "news"' });
    expect(result).toHaveLength(1);
    expect(result[0].$id).toBe(makeId(1));
  });

  test("filters with AND", () => {
    const result = findItems({
      filter: '$collection = "articles" && featured = true',
    });
    expect(result).toHaveLength(1);
    expect(result[0].$id).toBe(makeId(1));
  });

  test("filters with OR", () => {
    const result = findItems({
      filter: 'category = "news" || category = "docs"',
    });
    expect(result).toHaveLength(2);
  });

  test("supports like filter", () => {
    const result = findItems({ filter: 'title ~ "Post"' });
    expect(result).toHaveLength(2);
  });

  test("supports changedAt range", () => {
    const result = findItems({
      filter: "$changedAt >= 100 && $changedAt <= 150",
    });
    expect(result).toHaveLength(2);
  });

  test("sorts ascending by field", () => {
    const result = findItems({ sort: "$changedAt" });
    expect(result[0].$id).toBe(makeId(1));
    expect(result[2].$id).toBe(makeId(2));
  });

  test("sorts descending with - prefix", () => {
    const result = findItems({ sort: "-$changedAt" });
    expect(result[0].$id).toBe(makeId(2));
    expect(result[2].$id).toBe(makeId(1));
  });

  test("sorts with object notation", () => {
    const result = findItems({
      sort: { field: "$changedAt", direction: "asc" },
    });
    expect(result[0].$id).toBe(makeId(1));
  });

  test("respects limit", () => {
    const result = findItems({ limit: 2 });
    expect(result).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  test("respects offset", () => {
    const result = findItems({ sort: "$changedAt", limit: 2, offset: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].$id).toBe(makeId(3));
  });

  test("allows large limit", () => {
    const result = findItems({ limit: 500 });
    expect(result.limit).toBe(500);
  });

  test("excludes content by default", () => {
    const result = findItems();
    // content should not be present
    expect(result[0]).not.toHaveProperty("content");
  });

  test("includes content when requested", () => {
    const result = findItems({ include: ["content"] });
    // Items don't have content set, but the field should be queried
    expect(result).toHaveLength(3);
  });

  test("auto-includes content for collections whose schema has $content", () => {
    setCollection("articles", "Articles", { title: 1, $content: 0 });
    createItem({
      id: makeId(99),
      ref: "blog/tech/with-content",
      collection: "articles",
      props: { title: "With Content" },
      content: [["p", ["hello"]]],
      changedAt: 300,
    });

    const result = findItems({ filter: '$ref = "blog/tech/with-content"' });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBeDefined();

    // A collection without $content in its schema should not auto-include content.
    const guideResult = findItems({ filter: '$collection = "guides"' });
    for (const item of guideResult) {
      expect(item).not.toHaveProperty("content");
    }
  });

  test("supports search", () => {
    const result = findItems({ search: "Alpha" });
    expect(result).toHaveLength(1);
    expect(result[0].$id).toBe(makeId(1));
  });

  test("returns all selectable fields by default", () => {
    const result = findItems({ filter: '$collection = "articles"', sort: "$changedAt", limit: 1 });
    expect(result[0].title).toBe("Alpha Post");
    expect(result[0].$ref).toBe("blog/tech/alpha");
  });

  test("returns no selectable fields for empty fields array", () => {
    const result = findItems({ filter: '$collection = "articles"', fields: [], limit: 1 });
    expect(result[0].$id).toBeUndefined();
    expect(result[0].title).toBeUndefined();
  });

  test("projects specific fields", () => {
    const result = findItems({
      filter: '$collection = "articles"',
      fields: ["title", "$ref"],
      sort: "title",
      limit: 1,
    });
    expect(result[0].title).toBe("Alpha Post");
    expect(result[0].$ref).toBe("blog/tech/alpha");
    expect(result[0].$collection).toBeUndefined();
  });

  test("search matches ref", () => {
    const result = findItems({ search: "lifestyle" });
    expect(result).toHaveLength(1);
    expect(result[0].$id).toBe(makeId(2));
  });

  test("includes files when requested", () => {
    createFile({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });
    linkFileToItem(makeId(1), makeId(10));

    const result = findItems({
      filter: '$collection = "articles"',
      include: ["files"],
    });

    const item1 = result.find((i) => i.$id === makeId(1))!;
    const item2 = result.find((i) => i.$id === makeId(2))!;
    expect(item1.files).toHaveLength(1);
    expect(item1.files![0].id).toBe(makeId(10));
    expect(item2.files).toEqual([]);
  });

  test("includes content links when requested", () => {
    createItemLink({ prop: null, from: makeId(1), to: makeId(2), internal: true });

    const result = findItems({
      filter: '$collection = "articles"',
      include: ["links"],
    });

    const item1 = result.find((i) => i.$id === makeId(1))!;
    expect(item1.links).toHaveLength(1);
    expect((item1.links[0] as any).$id).toBe(makeId(2));
  });

  test("resolves with relations", () => {
    const result = findItems({
      filter: '$collection = "articles" && featured = true',
      with: {
        sameColl: {
          filter: "$collection = $1.$collection && $ref != $1.$ref",
        },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].sameColl as any[]).toHaveLength(1);
    expect((result[0].sameColl as any[])[0].$id).toBe(makeId(2));
  });

  test("relation values override projected raw fields", async () => {
    setCollection("persons", "Persons", { name: 1 });
    createItem({
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

    const { createOrUpdateItem } = await import("./createOrUpdateItem");
    createOrUpdateItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: { title: "Alpha Post", category: "news", featured: true, views: 10, author: linkId },
      changedAt: 100,
    });

    const result = findItems({
      filter: `$id = "${makeId(1)}"`,
      fields: ["author"],
      with: {
        author: {
          collection: "persons",
          single: true,
          filter: "$id = $1.author",
        },
      },
    });

    expect((result[0].author as any).name).toBe("Alice");
  });

  test("findItems with forward REF relation", async () => {
    setCollection("persons", "Persons", { name: 1 });

    createItem({
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
    createOrUpdateItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: { title: "Alpha Post", category: "news", featured: true, views: 10, author: linkId },
      changedAt: 100,
    });

    const result = findItems({
      filter: `$id = "${makeId(1)}"`,
      with: {
        author: {
          collection: "persons",
          single: true,
          filter: "$id = $1.author",
        },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].author).not.toBeNull();
    expect((result[0].author as any).$id).toBe(makeId(10));
  });

  test("findItems with backlink relation", async () => {
    setCollection("persons", "Persons", { name: 1 });

    createItem({
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
    createOrUpdateItem({
      id: makeId(1),
      ref: "blog/tech/alpha",
      collection: "articles",
      props: { title: "Alpha Post", category: "news", featured: true, views: 10, author: linkId1 },
      changedAt: 100,
    });
    createOrUpdateItem({
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
      filter: `$id = "${makeId(10)}"`,
      with: {
        posts: {
          collection: "articles",
          filter: 'linksTo("author") = $1.$id',
        },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].posts as any[]).toHaveLength(2);
    const postIds = (result[0].posts as any[]).map((p: any) => p.$id);
    expect(postIds).toContain(makeId(1));
    expect(postIds).toContain(makeId(2));
  });
});

describe("getItemById", () => {
  beforeEach(() => {
    truncateAllTables();
    seedItems();
  });

  test("returns item by id", () => {
    const item = getItemById(makeId(1));
    expect(item).not.toBeNull();
    expect(item!.$id).toBe(makeId(1));
    expect(item!.$collection).toBe("articles");
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

  test("resolves files when requested", () => {
    createFile({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });
    linkFileToItem(makeId(1), makeId(10));

    const item = getItemById(makeId(1), { include: ["files"] });
    expect(item!.files).toHaveLength(1);
  });

  test("resolves relations", () => {
    const item = getItemById(makeId(1), {
      with: {
        sameColl: {
          filter: "$collection = $1.$collection && $ref != $1.$ref",
        },
      },
    });

    expect(item!.sameColl as any[]).toHaveLength(1);
    expect((item!.sameColl as any[])[0].$id).toBe(makeId(2));
  });
});
