import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { createItem } from "../../features/items/createItem";
import { findItems } from "../../features/items/findItems";
import { resolveRelations } from "./resolve-relations";
import type { ItemWithRelations, WithClause } from "../../domain/query-types";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

describe("resolveRelations", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  test("resolves simple relation with :collection placeholder", async () => {
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
        filter: "collection = :collection && ref != :ref",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].relations).toBeDefined();
    expect(items[0].relations!.siblings).toHaveLength(1);
    expect(items[0].relations!.siblings[0].id).toBe(makeId(2));
  });

  test("resolves relation with :props.X placeholder", async () => {
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
        filter: "props.category = :props.category && ref != :ref",
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].relations!.sameCategory).toHaveLength(1);
    expect(items[0].relations!.sameCategory[0].id).toBe(makeId(2));
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
        filter: 'collection = "articles" && ref != :ref',
        limit: 1,
      },
    };

    resolveRelations(items, withClause, findItems);

    expect(items[0].relations!.others).toHaveLength(1);
  });

  test("skips when no items", () => {
    resolveRelations([], { test: { filter: 'collection = "x"' } }, findItems);
  });
});
