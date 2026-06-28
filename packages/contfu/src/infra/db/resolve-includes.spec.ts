import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import type { ItemWithRelations } from "../../domain/query-types";
import { setCollection } from "../../features/collections/setCollection";
import { createFile } from "../../features/files/createFile";
import { linkFileToItem } from "../../features/files/linkFileToItem";
import { createItem } from "../../features/items/createItem";
import { createItemLink } from "../../features/items/createItemLink";
import { db } from "./db";
import { externalLinkTable } from "./schema";
import { resolveIncludes } from "./resolve-includes";

function makeItem(seed: number, collection = "articles"): ItemWithRelations {
  return {
    $id: seed,
    $collection: collection,
    title: `Item ${seed}`,
    $changedAt: seed * 100,
    links: [],
  };
}

describe("resolveIncludes", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("c", "C", {});
    setCollection("articles", "Articles", {});
  });

  test("resolves files for items", () => {
    createItem({ id: 1, ref: "a", collection: "c", props: {}, changedAt: 100 });
    createItem({ id: 2, ref: "b", collection: "c", props: {}, changedAt: 200 });

    createFile({
      id: Buffer.from([10]).toString("base64url"),
      status: "ready",
      mediaType: "image",
      ext: "png",
      size: 1000,
      data: Buffer.from("binary"),
      createdAt: 100,
    });

    createFile({
      id: Buffer.from([11]).toString("base64url"),
      status: "ready",
      mediaType: "image",
      ext: "png",
      size: 2000,
      createdAt: 200,
    });

    const file10 = Buffer.from([10]).toString("base64url");
    const file11 = Buffer.from([11]).toString("base64url");
    linkFileToItem(1, file10);
    linkFileToItem(1, file11);
    linkFileToItem(2, file11);

    const items = [makeItem(1), makeItem(2)];
    resolveIncludes(items, ["files"]);

    expect(items[0].files).toHaveLength(2);
    expect(items[0].files![0]).not.toHaveProperty("data");
    expect(items[1].files).toHaveLength(1);
    expect(items[1].files![0].id).toBe(file11);
  });

  test("resolves content links for items", () => {
    createItem({ id: 1, ref: "a", collection: "c", props: {}, changedAt: 100 });
    createItem({ id: 2, ref: "b", collection: "c", props: {}, changedAt: 200 });
    createItem({ id: 3, ref: "c", collection: "c", props: {}, changedAt: 300 });

    // Content links (prop = null)
    createItemLink({ prop: null, from: 1, to: 2 });
    createItemLink({ prop: null, from: 1, to: 3 });
    // Prop link (should NOT appear on item.links)
    createItemLink({ prop: "author", from: 1, to: 3 });

    const items = [makeItem(1), makeItem(2)];
    resolveIncludes(items, ["links"]);

    // Only content links (prop IS NULL) should be resolved
    expect(items[0].links).toHaveLength(2);
    expect((items[0].links[0] as any).$id).toBe(2);
    expect((items[0].links[1] as any).$id).toBe(3);
    expect(items[1].links).toEqual([]);
  });

  test("resolves external content links as URL strings", () => {
    createItem({ id: 1, ref: "a", collection: "c", props: {}, changedAt: 100 });

    // External content link
    const url = "https://example.com/page";
    db.insert(externalLinkTable).values({ id: -1, from: 1, url }).run();

    const items = [makeItem(1)];
    resolveIncludes(items, ["links"]);

    expect(items[0].links).toHaveLength(1);
    expect(items[0].links[0]).toBe(url);
  });

  test("skips when no items", () => {
    resolveIncludes([], ["files", "links"]);
    // Should not throw
  });

  test("skips when no includes", () => {
    const items = [makeItem(1)];
    resolveIncludes(items, []);
    expect(items[0].files).toBeUndefined();
  });

  test("items without files get empty array", () => {
    createItem({ id: 1, ref: "a", collection: "c", props: {}, changedAt: 100 });

    const items = [makeItem(1)];
    resolveIncludes(items, ["files"]);

    expect(items[0].files).toEqual([]);
  });

  test("content link to missing item returns null", () => {
    createItem({ id: 1, ref: "a", collection: "c", props: {}, changedAt: 100 });

    // Internal content link to non-existent target
    createItemLink({ prop: null, from: 1, to: 99 });

    const items = [makeItem(1)];
    resolveIncludes(items, ["links"]);

    expect(items[0].links).toHaveLength(1);
    expect(items[0].links[0]).toBeNull();
  });
});
