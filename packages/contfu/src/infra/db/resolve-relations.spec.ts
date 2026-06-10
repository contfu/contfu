import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import type { WithClause } from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";
import { setCollection } from "../../features/collections/setCollection";
import { createItem } from "../../features/items/createItem";
import { createItemLink } from "../../features/items/createItemLink";
import { findItems } from "../../features/items/findItems";
import { updateItem } from "../../features/items/updateItem";
import { resolveRelations } from "./resolve-relations";

describe("resolveRelations", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("articles", "Articles", {});
    setCollection("guides", "Guides", {});
  });

  test("resolves simple relation with $1.$collection placeholder", () => {
    createItem({
      id: 1,
      ref: "a",
      collection: "articles",
      props: { title: "A" },
      changedAt: 100,
    });
    createItem({
      id: 2,
      ref: "b",
      collection: "articles",
      props: { title: "B" },
      changedAt: 200,
    });
    createItem({
      id: 3,
      ref: "c",
      collection: "guides",
      props: { title: "C" },
      changedAt: 300,
    });

    const parent: ItemWithRelations = {
      $id: 1,
      $collection: "articles",
      title: "A",
      $changedAt: 100,
      links: [],
    };
    const items = [parent];

    const withClause: WithClause = {
      siblings: {
        filter: "$collection = $1.$collection && $id != $1.$id",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].siblings as any[]).toHaveLength(1);
    expect((items[0].siblings as any[])[0].$id).toBe(2);
  });

  test("resolves relation with $1.property placeholder", () => {
    createItem({
      id: 1,
      ref: "a",
      collection: "articles",
      props: { title: "A", category: "news" },
      changedAt: 100,
    });
    createItem({
      id: 2,
      ref: "b",
      collection: "articles",
      props: { title: "B", category: "news" },
      changedAt: 200,
    });
    createItem({
      id: 3,
      ref: "c",
      collection: "articles",
      props: { title: "C", category: "tech" },
      changedAt: 300,
    });

    const parent: ItemWithRelations = {
      $id: 1,
      $collection: "articles",
      title: "A",
      category: "news",
      $changedAt: 100,
      links: [],
    };
    const items = [parent];

    const withClause: WithClause = {
      sameCategory: {
        filter: "category = $1.category && $id != $1.$id",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].sameCategory as any[]).toHaveLength(1);
    expect((items[0].sameCategory as any[])[0].$id).toBe(2);
  });

  test("respects limit on relations", () => {
    createItem({
      id: 1,
      ref: "a",
      collection: "articles",
      props: {},
      changedAt: 100,
    });
    createItem({
      id: 2,
      ref: "b",
      collection: "articles",
      props: {},
      changedAt: 200,
    });
    createItem({
      id: 3,
      ref: "c",
      collection: "articles",
      props: {},
      changedAt: 300,
    });

    const items: ItemWithRelations[] = [
      {
        $id: 1,
        $collection: "articles",
        $changedAt: 100,
        links: [],
      },
    ];

    const withClause: WithClause = {
      others: {
        filter: '$collection = "articles" && $id != $1.$id',
        limit: 1,
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].others as any[]).toHaveLength(1);
  });

  test("skips when no items", () => {
    resolveRelations([], { test: { filter: '$collection = "x"' } }, findItems);
  });

  test("forward REF — post → author via link", () => {
    setCollection("posts", "Posts", { title: 1 });
    setCollection("persons", "Persons", { name: 1 });

    createItem({
      id: 10,
      ref: "person/alice",
      collection: "persons",
      props: { name: "Alice" },
      changedAt: 100,
    });

    createItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First Post" },
      changedAt: 200,
    });

    const linkId = createItemLink({
      prop: "author",
      from: 1,
      to: 10,
    });

    updateItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First Post", author: linkId },
      changedAt: 200,
    });

    const items: ItemWithRelations[] = [
      {
        $id: 1,
        $collection: "posts",
        title: "First Post",
        author: linkId,
        $changedAt: 200,
        links: [],
      },
    ];

    const withClause: WithClause = {
      author: {
        collection: "persons",
        single: true,
        filter: "$id = $1.author",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].author).not.toBeNull();
    expect((items[0].author as any).$id).toBe(10);
  });

  test("forward REF — null for external link", () => {
    setCollection("posts", "Posts", { title: 1 });
    setCollection("persons", "Persons", { name: 1 });

    createItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First Post" },
      changedAt: 200,
    });

    const linkId = createItemLink({
      prop: "author",
      from: 1,
      to: 10,
    });

    updateItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First Post", author: linkId },
      changedAt: 200,
    });

    const items: ItemWithRelations[] = [
      {
        $id: 1,
        $collection: "posts",
        title: "First Post",
        author: linkId,
        $changedAt: 200,
        links: [],
      },
    ];

    const withClause: WithClause = {
      author: {
        collection: "persons",
        single: true,
        filter: "$id = $1.author",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].author).toBeNull();
  });

  test("forward REF — null for missing link", () => {
    setCollection("posts", "Posts", { title: 1 });
    setCollection("persons", "Persons", { name: 1 });

    createItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First Post", author: 9999 },
      changedAt: 200,
    });

    const items: ItemWithRelations[] = [
      {
        $id: 1,
        $collection: "posts",
        title: "First Post",
        author: 9999,
        $changedAt: 200,
        links: [],
      },
    ];

    const withClause: WithClause = {
      author: {
        collection: "persons",
        single: true,
        filter: "$id = $1.author",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].author).toBeNull();
  });

  test("backlink REF — person → posts via linksTo", () => {
    setCollection("posts", "Posts", { title: 1 });
    setCollection("persons", "Persons", { name: 1 });

    createItem({
      id: 10,
      ref: "person/alice",
      collection: "persons",
      props: { name: "Alice" },
      changedAt: 100,
    });

    createItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First" },
      changedAt: 200,
    });

    createItem({
      id: 2,
      ref: "post/second",
      collection: "posts",
      props: { title: "Second" },
      changedAt: 300,
    });

    const linkId1 = createItemLink({
      prop: "author",
      from: 1,
      to: 10,
    });

    const linkId2 = createItemLink({
      prop: "author",
      from: 2,
      to: 10,
    });

    updateItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First", author: linkId1 },
      changedAt: 200,
    });

    updateItem({
      id: 2,
      ref: "post/second",
      collection: "posts",
      props: { title: "Second", author: linkId2 },
      changedAt: 300,
    });

    const personItems: ItemWithRelations[] = [
      {
        $id: 10,
        $collection: "persons",
        name: "Alice",
        $changedAt: 100,
        links: [],
      },
    ];

    const withClause: WithClause = {
      posts: {
        collection: "posts",
        filter: 'linksTo("author") = $1.$id',
      },
    };

    resolveRelations(personItems, withClause, findItems);

    expect(personItems[0].posts as any[]).toHaveLength(2);
    const postIds = (personItems[0].posts as any[]).map((p: any) => p.$id);
    expect(postIds).toContain(1);
    expect(postIds).toContain(2);
  });

  test("backlink REFS — tag → posts via linksTo", () => {
    setCollection("posts", "Posts", { title: 1 });
    setCollection("tags", "Tags", { label: 1 });

    createItem({
      id: 30,
      ref: "tag/tech",
      collection: "tags",
      props: { label: "Tech" },
      changedAt: 100,
    });

    createItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First" },
      changedAt: 200,
    });

    const linkId1 = createItemLink({
      prop: "tags",
      from: 1,
      to: 30,
    });

    updateItem({
      id: 1,
      ref: "post/first",
      collection: "posts",
      props: { title: "First", tags: [linkId1] },
      changedAt: 200,
    });

    const tagItems: ItemWithRelations[] = [
      {
        $id: 30,
        $collection: "tags",
        label: "Tech",
        $changedAt: 100,
        links: [],
      },
    ];

    const withClause: WithClause = {
      posts: {
        collection: "posts",
        filter: 'linksTo("tags") = $1.$id',
      },
    };

    resolveRelations(tagItems, withClause, findItems);

    expect(tagItems[0].posts as any[]).toHaveLength(1);
    expect((tagItems[0].posts as any[])[0].$id).toBe(1);
  });
});
