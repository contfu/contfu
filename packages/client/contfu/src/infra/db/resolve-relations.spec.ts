import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import type { ItemWithRelations, WithClause } from "../../domain/query-types";
import { setCollection } from "../../features/collections/setCollection";
import { createItem } from "../../features/items/createItem";
import { findItems } from "../../features/items/findItems";
import { resolveRelations } from "./resolve-relations";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

describe("resolveRelations", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await setCollection("articles", "Articles", {});
    await setCollection("guides", "Guides", {});
  });

  test("resolves simple relation with $1.collection placeholder", async () => {
    await createItem({
      id: makeId(1),
      ref: "a",
      collection: "articles",
      props: { title: "A" },
      changedAt: 100,
    });
    await createItem({
      id: makeId(2),
      ref: "b",
      collection: "articles",
      props: { title: "B" },
      changedAt: 200,
    });
    await createItem({
      id: makeId(3),
      ref: "c",
      collection: "guides",
      props: { title: "C" },
      changedAt: 300,
    });

    const parent: ItemWithRelations = {
      id: makeId(1),
      ref: "a",
      collection: "articles",
      props: { title: "A" },
      changedAt: 100,
      links: { content: [] },
    };
    const items = [parent];

    const withClause: WithClause = {
      siblings: {
        filter: "collection = $1.collection && ref != $1.ref",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].rels).toBeDefined();
    expect(items[0].rels!.siblings).toHaveLength(1);
    expect((items[0].rels!.siblings as any[])[0].id).toBe(makeId(2));
  });

  test("resolves relation with $1.props.X placeholder", async () => {
    await createItem({
      id: makeId(1),
      ref: "a",
      collection: "articles",
      props: { title: "A", category: "news" },
      changedAt: 100,
    });
    await createItem({
      id: makeId(2),
      ref: "b",
      collection: "articles",
      props: { title: "B", category: "news" },
      changedAt: 200,
    });
    await createItem({
      id: makeId(3),
      ref: "c",
      collection: "articles",
      props: { title: "C", category: "tech" },
      changedAt: 300,
    });

    const parent: ItemWithRelations = {
      id: makeId(1),
      ref: "a",
      collection: "articles",
      props: { title: "A", category: "news" },
      changedAt: 100,
      links: { content: [] },
    };
    const items = [parent];

    const withClause: WithClause = {
      sameCategory: {
        filter: "props.category = $1.props.category && ref != $1.ref",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].rels!.sameCategory).toHaveLength(1);
    expect((items[0].rels!.sameCategory as any[])[0].id).toBe(makeId(2));
  });

  test("respects limit on relations", async () => {
    await createItem({
      id: makeId(1),
      ref: "a",
      collection: "articles",
      props: {},
      changedAt: 100,
    });
    await createItem({
      id: makeId(2),
      ref: "b",
      collection: "articles",
      props: {},
      changedAt: 200,
    });
    await createItem({
      id: makeId(3),
      ref: "c",
      collection: "articles",
      props: {},
      changedAt: 300,
    });

    const items: ItemWithRelations[] = [
      {
        id: makeId(1),
        ref: "a",
        collection: "articles",
        props: {},
        changedAt: 100,
        links: { content: [] },
      },
    ];

    const withClause: WithClause = {
      others: {
        filter: 'collection = "articles" && ref != $1.ref',
        limit: 1,
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].rels!.others).toHaveLength(1);
  });

  test("skips when no items", () => {
    resolveRelations([], { test: { filter: 'collection = "x"' } }, findItems);
  });
});
