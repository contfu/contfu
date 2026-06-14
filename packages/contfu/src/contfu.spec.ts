import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../test/setup";
import { contfu } from "./contfu";

import { setCollection } from "./features/collections/setCollection";
import { createItem } from "./features/items/createItem";
import { createItemLink } from "./features/items/createItemLink";

function seedData() {
  setCollection("articles", "Articles", {});
  setCollection("authors", "Authors", {});
  setCollection("tags", "Tags", {});

  createItem({
    id: 1,
    ref: "articles/alpha",
    collection: "articles",
    props: { title: "Alpha", category: "news", author: "Alice" },
    changedAt: 100,
  });

  createItem({
    id: 2,
    ref: "articles/beta",
    collection: "articles",
    props: { title: "Beta", category: "tech", author: "Bob" },
    changedAt: 200,
  });

  createItem({
    id: 3,
    ref: "authors/alice",
    collection: "authors",
    props: { name: "Alice" },
    changedAt: 300,
  });

  createItem({
    id: 4,
    ref: "authors/bob",
    collection: "authors",
    props: { name: "Bob" },
    changedAt: 400,
  });

  createItem({
    id: 5,
    ref: "tags/tech",
    collection: "tags",
    props: { label: "Tech" },
    changedAt: 500,
  });
}

type Collections = {
  articles: { title: string; category: string; author: string };
  authors: { name: string };
  tags: { label: string };
};

describe("contfu typed query client", () => {
  const { query: q } = contfu<Collections>();
  const { all, oneOf, eq } = q;

  beforeEach(() => {
    truncateAllTables();
    seedData();
  });

  test("q(collection) filters by collection", async () => {
    const result = await q("articles");
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.$collection === "articles")).toBe(true);
  });

  test("q(collection, filter) combines collection and filter", async () => {
    const result = await q("articles", 'category = "news"');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Alpha");
  });

  test("q({ filter }) without collection returns all matching", async () => {
    const result = await q({ filter: 'category = "news"' });
    expect(result).toHaveLength(1);
    expect(result[0].$collection).toBe("articles");
  });

  test("q() without options returns all items", async () => {
    const result = await q();
    expect(result).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  test("q(collection, { limit }) respects limit", async () => {
    const result = await q("authors", { limit: 1 });
    expect(result).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  test("q(collection, { sort }) respects sort order", async () => {
    const result = await q("articles", { sort: "title" });
    expect(result[0].title).toBe("Alpha");
    expect(result[1].title).toBe("Beta");
  });

  test("q(collection, { with }) resolves relations", async () => {
    const result = await q("articles", {
      with: {
        writers: all("authors"),
      },
    });
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item.writers as any[]).toHaveLength(2);
    }
  });

  test("function-based with + eq + single resolves 1:1 relation", async () => {
    const result = await q("articles", {
      with: (article) => ({
        author: oneOf("authors", (author) => eq(author.name, article.author)),
      }),
    });
    expect(result).toHaveLength(2);

    const alpha = result.find((i) => i.title === "Alpha")!;
    expect(alpha.author).not.toBeNull();
    expect((alpha.author as any).name).toBe("Alice");

    const beta = result.find((i) => i.title === "Beta")!;
    expect((beta.author as any).name).toBe("Bob");
  });

  test("string-based $1 placeholder resolves relations as array", async () => {
    const result = await q("articles", {
      with: {
        author: all("authors", "name = $1.author"),
      },
    });
    expect(result).toHaveLength(2);

    const alpha = result.find((i) => i.title === "Alpha")!;
    expect(alpha.author).toHaveLength(1);
    expect((alpha.author as any[])[0].name).toBe("Alice");
  });
});

// --- Typed ref target tests ---
// When generateApplicationIntegrationTypes is configured with refTargets, REF/REFS properties
// reference sibling collection types instead of plain strings. These tests verify
// the query client types work correctly with that pattern.

type RefTargetCollections = {
  authors: { name: string };
  tags: { label: string };
  blogPosts: {
    title: string;
    author: RefTargetCollections["authors"]; // REF → single target
    tags: RefTargetCollections["tags"][]; // REFS → array of targets
  };
};

describe("contfu typed ref targets", () => {
  const { query: q } = contfu<RefTargetCollections>();

  beforeEach(() => {
    truncateAllTables();
    setCollection("authors", "Authors", {});
    setCollection("tags", "Tags", {});
    setCollection("blogPosts", "Blog Posts", {});

    createItem({
      id: 10,
      ref: "authors/alice",
      collection: "authors",
      props: { name: "Alice" },
      changedAt: 100,
    });
    createItem({
      id: 30,
      ref: "tags/tech",
      collection: "tags",
      props: { label: "Tech" },
      changedAt: 200,
    });
    createItem({
      id: 1,
      ref: "blogPosts/hello",
      collection: "blogPosts",
      props: {
        title: "Hello",
        author: { name: "Alice" },
        tags: [{ label: "Tech" }],
      },
      changedAt: 300,
    });
  });

  test("REF property is typed as the target collection", async () => {
    const result = await q("blogPosts");
    const post = result[0];

    // At the type level: post.author is RefTargetCollections["authors"]
    // which has { name: string }, so .name should be accessible.
    const authorName: string = post.author.name;
    expect(authorName).toBe("Alice");
  });

  test("REFS property is typed as array of target collection", async () => {
    const result = await q("blogPosts");
    const post = result[0];

    // At the type level: post.tags is RefTargetCollections["tags"][]
    // which is { label: string }[], so [0].label should be accessible.
    const tagLabel: string = post.tags[0].label;
    expect(tagLabel).toBe("Tech");
  });
});

// --- Link resolution tests ---

type LinkCollections = {
  posts: { title: string; author: number; tags: number[] };
  persons: { name: string };
  tags: { label: string };
};

function seedLinkData() {
  setCollection("persons", "Persons", {});
  setCollection("tags", "Tags", {});
  setCollection("posts", "Posts", {});

  // Create persons
  createItem({
    id: 10,
    ref: "persons/alice",
    collection: "persons",
    props: { name: "Alice" },
    changedAt: 100,
  });
  createItem({
    id: 11,
    ref: "persons/bob",
    collection: "persons",
    props: { name: "Bob" },
    changedAt: 101,
  });

  // Create tags
  createItem({
    id: 30,
    ref: "tags/tech",
    collection: "tags",
    props: { label: "Tech" },
    changedAt: 200,
  });
  createItem({
    id: 31,
    ref: "tags/design",
    collection: "tags",
    props: { label: "Design" },
    changedAt: 201,
  });

  // Create posts (items must exist before links due to FK)
  createItem({
    id: 1,
    ref: "posts/post1",
    collection: "posts",
    props: { title: "Post One", author: 10, tags: [30, 31] },
    changedAt: 300,
  });
  createItem({
    id: 2,
    ref: "posts/post2",
    collection: "posts",
    props: { title: "Post Two", author: 11, tags: [30] },
    changedAt: 301,
  });

  // REF links: post → author
  createItemLink({ prop: "author", from: 1, to: 10 });
  createItemLink({ prop: "author", from: 2, to: 11 });

  // REFS links: post → tags
  createItemLink({ prop: "tags", from: 1, to: 30 });
  createItemLink({ prop: "tags", from: 1, to: 31 });
  createItemLink({ prop: "tags", from: 2, to: 30 });

  // Content links (prop=null): post1 → alice, post2 → bob
  createItemLink({ prop: null, from: 1, to: 10 });
  createItemLink({ prop: null, from: 2, to: 11 });
}

describe("contfu link resolution", () => {
  const { query: q } = contfu<LinkCollections>();
  const { oneOf, eq, linksTo, linkedFrom } = q;

  beforeEach(() => {
    truncateAllTables();
    seedLinkData();
  });

  test("forward REF: post → author via props", async () => {
    const result = await q("posts", {
      filter: 'title = "Post One"',
      with: (post) => ({
        author: oneOf("persons", (person) => eq(person.$id, post.author)),
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].author).not.toBeNull();
    expect((result[0].author as any).name).toBe("Alice");
  });

  test("backlink REF: person → posts via linksTo('author')", async () => {
    const aliceId = 10;
    const result = await q("posts", linksTo("author", aliceId));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Post One");
  });

  test("forward REFS: post → tags via linkedFrom('tags')", async () => {
    const post1Id = 1;
    const result = await q("tags", linkedFrom("tags", post1Id));
    expect(result).toHaveLength(2);
    const labels = result.map((t) => t.label).sort();
    expect(labels).toEqual(["Design", "Tech"]);
  });

  test("backlink REFS: tag → posts via linksTo('tags')", async () => {
    const techId = 30;
    const result = await q("posts", linksTo("tags", techId));
    expect(result).toHaveLength(2);
    const titles = result.map((p) => p.title).sort((a, b) => (a ?? "").localeCompare(b ?? ""));
    expect(titles).toEqual(["Post One", "Post Two"]);
  });

  test("forward content links: post → linked items via linkedFrom(null)", async () => {
    const post1Id = 1;
    const result = await q("persons", linkedFrom(null, post1Id));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  test("backlink content links: person → posts via linksTo(null)", async () => {
    const aliceId = 10;
    const result = await q("posts", linksTo(null, aliceId));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Post One");
  });
});
