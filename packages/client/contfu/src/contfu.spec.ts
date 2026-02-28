import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../test/setup";
import { contfu } from "./contfu";
import { all, eq, linkedFrom, linksTo, oneOf } from "./domain/filter-helpers";

import { setCollection } from "./features/collections/setCollection";
import { createItem } from "./features/items/createItem";
import { createItemLink } from "./features/items/createItemLink";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

async function seedData() {
  await setCollection("articles", "Articles", {});
  await setCollection("authors", "Authors", {});
  await setCollection("tags", "Tags", {});

  await createItem({
    id: makeId(1),
    ref: "articles/alpha",
    collection: "articles",
    props: { title: "Alpha", category: "news", author: "authors/alice" },
    changedAt: 100,
  });

  await createItem({
    id: makeId(2),
    ref: "articles/beta",
    collection: "articles",
    props: { title: "Beta", category: "tech", author: "authors/bob" },
    changedAt: 200,
  });

  await createItem({
    id: makeId(3),
    ref: "authors/alice",
    collection: "authors",
    props: { name: "Alice" },
    changedAt: 300,
  });

  await createItem({
    id: makeId(4),
    ref: "authors/bob",
    collection: "authors",
    props: { name: "Bob" },
    changedAt: 400,
  });

  await createItem({
    id: makeId(5),
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
  const q = contfu<Collections>();

  beforeEach(async () => {
    await truncateAllTables();
    await seedData();
  });

  test("q({ collection }) filters by collection", async () => {
    const result = await q({ collection: "articles" });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((i) => i.collection === "articles")).toBe(true);
  });

  test("q({ collection, filter }) combines collection and filter", async () => {
    const result = await q({
      collection: "articles",
      filter: 'props.category = "news"',
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].props.title).toBe("Alpha");
  });

  test("q({ filter }) without collection returns all matching", async () => {
    const result = await q({ filter: 'props.category = "news"' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].collection).toBe("articles");
  });

  test("q() without options returns all items", async () => {
    const result = await q();
    expect(result.data).toHaveLength(5);
    expect(result.meta.total).toBe(5);
  });

  test("q({ collection, limit }) respects limit", async () => {
    const result = await q({ collection: "authors", limit: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(2);
  });

  test("q({ collection, sort }) respects sort order", async () => {
    const result = await q({ collection: "articles", sort: "props.title" });
    expect(result.data[0].props.title).toBe("Alpha");
    expect(result.data[1].props.title).toBe("Beta");
  });

  test("q() with collection in with-clause resolves relations", async () => {
    const result = await q({
      collection: "articles",
      with: {
        writers: all("authors"),
      },
    });
    expect(result.data).toHaveLength(2);
    for (const item of result.data) {
      expect(item.rels.writers).toHaveLength(2);
    }
  });

  test("function-based with + eq + single resolves 1:1 relation", async () => {
    const result = await q({
      collection: "articles",
      with: (article) => ({
        author: oneOf("authors", (author) => eq(author.ref, article.props.author)),
      }),
    });
    expect(result.data).toHaveLength(2);

    const alpha = result.data.find((i) => i.props.title === "Alpha")!;
    expect(alpha.rels.author).not.toBeNull();
    expect(alpha.rels.author!.ref).toBe("authors/alice");

    const beta = result.data.find((i) => i.props.title === "Beta")!;
    expect(beta.rels.author!.ref).toBe("authors/bob");
  });

  test("string-based $1 placeholder resolves relations as array", async () => {
    const result = await q({
      collection: "articles",
      with: {
        author: all("authors", "ref = $1.props.author"),
      },
    });
    expect(result.data).toHaveLength(2);

    const alpha = result.data.find((i) => i.props.title === "Alpha")!;
    expect(alpha.rels.author).toHaveLength(1);
    expect(alpha.rels.author[0].ref).toBe("authors/alice");
  });
});

describe("contfu flat format", () => {
  const q = contfu<Collections>({ flat: true });

  beforeEach(async () => {
    await truncateAllTables();
    await seedData();
  });

  test("flat client merges props into top level", async () => {
    const result = await q({ collection: "articles", sort: "props.title" });

    expect(result.data).toHaveLength(2);
    const alpha = result.data[0];
    expect(alpha.title).toBe("Alpha");
    expect(alpha.category).toBe("news");
    expect(alpha.collection).toBe("articles");
    expect(alpha.id).toBeDefined();
    // props/rels should not exist as nested objects
    expect("props" in alpha).toBe(false);
    expect("rels" in alpha).toBe(false);
  });

  test("flat with relations recursively flattens related items", async () => {
    const result = await q({
      collection: "articles",
      with: (article) => ({
        author: oneOf("authors", (author) => eq(author.ref, article.props.author)),
      }),
    });

    const alpha = result.data.find((i) => i.title === "Alpha")!;
    expect(alpha.author).not.toBeNull();
    expect(alpha.author!.name).toBe("Alice");
    expect(alpha.author!.ref).toBe("authors/alice");
    // Related item should also be flat
    expect("props" in alpha.author!).toBe(false);
  });

  test("per-query flat override on non-flat client", async () => {
    const result = await q({ collection: "articles", sort: "props.title" }, { flat: true });

    const alpha = result.data[0];
    expect(alpha.title).toBe("Alpha");
    expect("props" in alpha).toBe(false);
  });

  test("per-query flat=false override on flat client", async () => {
    const result = await q({ collection: "articles", sort: "props.title" }, { flat: false });

    const alpha = result.data[0];
    expect(alpha.props.title).toBe("Alpha");
    expect(alpha.rels).toBeUndefined();
  });

  test("flat with array relations flattens each item", async () => {
    const result = await q({
      collection: "articles",
      with: {
        writers: all("authors"),
      },
    });

    const item = result.data[0];
    expect(item.writers).toHaveLength(2);
    for (const writer of item.writers) {
      expect(writer.name).toBeDefined();
      expect("props" in writer).toBe(false);
    }
  });
});

// --- Link resolution tests ---

type LinkCollections = {
  posts: { title: string; author: string; tags: string[] };
  persons: {};
  tags: {};
};

async function seedLinkData() {
  await setCollection("persons", "Persons", {});
  await setCollection("tags", "Tags", {});
  await setCollection("posts", "Posts", {});

  // Create persons
  await createItem({
    id: makeId(10),
    ref: "persons/alice",
    collection: "persons",
    props: {},
    changedAt: 100,
  });
  await createItem({
    id: makeId(11),
    ref: "persons/bob",
    collection: "persons",
    props: {},
    changedAt: 101,
  });

  // Create tags
  await createItem({
    id: makeId(30),
    ref: "tags/tech",
    collection: "tags",
    props: {},
    changedAt: 200,
  });
  await createItem({
    id: makeId(31),
    ref: "tags/design",
    collection: "tags",
    props: {},
    changedAt: 201,
  });

  // Create posts (items must exist before links due to FK)
  await createItem({
    id: makeId(1),
    ref: "posts/post1",
    collection: "posts",
    props: { title: "Post One", author: makeId(10), tags: [makeId(30), makeId(31)] },
    changedAt: 300,
  });
  await createItem({
    id: makeId(2),
    ref: "posts/post2",
    collection: "posts",
    props: { title: "Post Two", author: makeId(11), tags: [makeId(30)] },
    changedAt: 301,
  });

  // REF links: post → author
  createItemLink({ prop: "author", from: makeId(1), to: makeId(10), internal: true });
  createItemLink({ prop: "author", from: makeId(2), to: makeId(11), internal: true });

  // REFS links: post → tags
  createItemLink({ prop: "tags", from: makeId(1), to: makeId(30), internal: true });
  createItemLink({ prop: "tags", from: makeId(1), to: makeId(31), internal: true });
  createItemLink({ prop: "tags", from: makeId(2), to: makeId(30), internal: true });

  // Content links (prop=null): post1 → alice, post2 → bob
  createItemLink({ prop: null, from: makeId(1), to: makeId(10), internal: true });
  createItemLink({ prop: null, from: makeId(2), to: makeId(11), internal: true });
}

describe("contfu link resolution", () => {
  const q = contfu<LinkCollections>();

  beforeEach(async () => {
    await truncateAllTables();
    await seedLinkData();
  });

  test("forward REF: post → author via props", async () => {
    const result = await q({
      collection: "posts",
      filter: 'props.title = "Post One"',
      with: (post) => ({
        author: oneOf("persons", (person) => eq(person.id, post.props.author)),
      }),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].rels.author).not.toBeNull();
    expect(result.data[0].rels.author!.ref).toBe("persons/alice");
  });

  test("backlink REF: person → posts via linksTo('author')", async () => {
    const aliceId = makeId(10);
    const result = await q({
      collection: "posts",
      filter: linksTo("author", aliceId),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].props.title).toBe("Post One");
  });

  test("forward REFS: post → tags via linkedFrom('tags')", async () => {
    const post1Id = makeId(1);
    const result = await q({
      collection: "tags",
      filter: linkedFrom("tags", post1Id),
    });
    expect(result.data).toHaveLength(2);
    const refs = result.data.map((t) => t.ref).sort();
    expect(refs).toEqual(["tags/design", "tags/tech"]);
  });

  test("backlink REFS: tag → posts via linksTo('tags')", async () => {
    const techId = makeId(30);
    const result = await q({
      collection: "posts",
      filter: linksTo("tags", techId),
    });
    expect(result.data).toHaveLength(2);
    const titles = result.data.map((p) => p.props.title).sort();
    expect(titles).toEqual(["Post One", "Post Two"]);
  });

  test("forward content links: post → linked items via linkedFrom(null)", async () => {
    const post1Id = makeId(1);
    const result = await q({
      collection: "persons",
      filter: linkedFrom(null, post1Id),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].ref).toBe("persons/alice");
  });

  test("backlink content links: person → posts via linksTo(null)", async () => {
    const aliceId = makeId(10);
    const result = await q({
      collection: "posts",
      filter: linksTo(null, aliceId),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].props.title).toBe("Post One");
  });
});
