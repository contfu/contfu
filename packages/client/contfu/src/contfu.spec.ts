import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../test/setup";
import { contfu } from "./contfu";
import { eq } from "./domain/filter-helpers";

import { createItem } from "./features/items/createItem";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

async function seedData() {
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
        writers: {
          collection: "authors",
        },
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
        author: {
          collection: "authors",
          single: true,
          filter: (author) => eq(author.ref, article.props.author),
        },
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
        author: {
          collection: "authors",
          filter: "ref = $1.props.author",
        },
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
        author: {
          collection: "authors",
          single: true,
          filter: (author) => eq(author.ref, article.props.author),
        },
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
        writers: { collection: "authors" },
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
