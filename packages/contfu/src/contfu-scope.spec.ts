import { beforeEach, expect, test } from "bun:test";
import { truncateAllTables } from "../test/setup";
import { contfu } from "./contfu";
import { createItem } from "./features/items/createItem";
import { setCollection } from "./features/collections/setCollection";
import { queryItems } from "./features/items/queryItems";
import { db } from "./infra/db/db";
import { itemsTable } from "./infra/db/schema";

beforeEach(() => {
  truncateAllTables();
  setCollection("posts", "Posts", {});
  for (const [id, scope] of [
    [1, "master"],
    [2, "staging"],
    [3, undefined],
  ] as const) {
    createItem({
      id,
      collection: "posts",
      ref: "same-native-entry",
      changedAt: 1,
      props: { title: "Same entry", ...(scope === undefined ? {} : { $scope: scope }) },
    });
  }
});

test("scope round-trips in props JSON and supports typed, string and property filters", async () => {
  const { query } = contfu<{ posts: { title: string; $scope?: string } }>();
  const typed = await query("posts", { filter: (p) => query.eq(p.$scope, "staging") });
  expect(typed.map((item) => item.$id)).toEqual([["posts", 2]]);
  expect(typed[0].$scope).toBe("staging");
  expect((await query("posts", { filter: '$scope = "master"' })).map((item) => item.$id)).toEqual([
    ["posts", 1],
  ]);
  expect(
    queryItems({ propFilters: [{ key: "$scope", op: "eq", value: "staging" }] }).items.map(
      (item) => item.id,
    ),
  ).toEqual([2]);
  const unscoped = await query("posts", { filter: "$scope = null" });
  expect(unscoped.map((item) => item.$id)).toEqual([["posts", 3]]);
  expect(unscoped[0]).not.toHaveProperty("$scope");
  expect(db.select().from(itemsTable).all()[1].props).toMatchObject({ $scope: "staging" });
});
