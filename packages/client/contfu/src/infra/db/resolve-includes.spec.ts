import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import type { ItemWithRelations } from "../../domain/query-types";
import { setCollection } from "../../features/collections/setCollection";
import { createAsset } from "../../features/assets/createAsset";
import { linkAssetToItem } from "../../features/assets/linkAssetToItem";
import { createItem } from "../../features/items/createItem";
import { createItemLink } from "../../features/items/createItemLink";
import { resolveIncludes } from "./resolve-includes";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

function makeItem(seed: number, collection = "articles"): ItemWithRelations {
  return {
    id: makeId(seed),
    ref: `test/${seed}`,
    collection,
    props: { title: `Item ${seed}` },
    changedAt: seed * 100,
    links: { content: [] },
  };
}

describe("resolveIncludes", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await setCollection("c", "C", {});
    await setCollection("articles", "Articles", {});
  });

  test("resolves assets for items", async () => {
    await createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });
    await createItem({ id: makeId(2), ref: "b", collection: "c", props: {}, changedAt: 200 });

    await createAsset({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });

    await createAsset({
      id: makeId(11),
      originalUrl: "https://example.com/img2.png",
      mediaType: "image/png",
      ext: "png",
      size: 2000,
      createdAt: 200,
    });

    await linkAssetToItem(makeId(1), makeId(10));
    await linkAssetToItem(makeId(1), makeId(11));
    await linkAssetToItem(makeId(2), makeId(11));

    const items = [makeItem(1), makeItem(2)];
    await resolveIncludes(items, ["assets"]);

    expect(items[0].assets).toHaveLength(2);
    expect(items[1].assets).toHaveLength(1);
    expect(items[1].assets![0].id).toBe(makeId(11));
  });

  test("resolves links for items", async () => {
    await createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });
    await createItem({ id: makeId(2), ref: "b", collection: "c", props: {}, changedAt: 200 });
    await createItem({ id: makeId(3), ref: "c", collection: "c", props: {}, changedAt: 300 });

    await createItemLink({ type: "related", from: makeId(1), to: makeId(2) });
    await createItemLink({ type: "related", from: makeId(1), to: makeId(3) });

    const items = [makeItem(1), makeItem(2)];
    await resolveIncludes(items, ["links"]);

    expect(items[0].links.related).toEqual([makeId(2), makeId(3)]);
    expect(items[1].links).toEqual({ content: [] });
  });

  test("skips when no items", async () => {
    await resolveIncludes([], ["assets", "links"]);
    // Should not throw
  });

  test("skips when no includes", async () => {
    const items = [makeItem(1)];
    await resolveIncludes(items, []);
    expect(items[0].assets).toBeUndefined();
  });

  test("items without assets get empty array", async () => {
    await createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });

    const items = [makeItem(1)];
    await resolveIncludes(items, ["assets"]);

    expect(items[0].assets).toEqual([]);
  });
});
