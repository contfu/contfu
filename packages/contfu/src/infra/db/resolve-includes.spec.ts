import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import type { ItemWithRelations } from "../../domain/query-types";
import { setCollection } from "../../features/collections/setCollection";
import { createFile } from "../../features/files/createFile";
import { linkFileToItem } from "../../features/files/linkFileToItem";
import { createItem } from "../../features/items/createItem";
import { createItemLink } from "../../features/items/createItemLink";
import { resolveIncludes } from "./resolve-includes";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

function makeItem(seed: number, collection = "articles"): ItemWithRelations {
  return {
    $id: makeId(seed),
    $ref: `test/${seed}`,
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
    createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });
    createItem({ id: makeId(2), ref: "b", collection: "c", props: {}, changedAt: 200 });

    createFile({
      id: makeId(10),
      originalUrl: "https://example.com/img.png",
      mediaType: "image/png",
      ext: "png",
      size: 1000,
      createdAt: 100,
    });

    createFile({
      id: makeId(11),
      originalUrl: "https://example.com/img2.png",
      mediaType: "image/png",
      ext: "png",
      size: 2000,
      createdAt: 200,
    });

    linkFileToItem(makeId(1), makeId(10));
    linkFileToItem(makeId(1), makeId(11));
    linkFileToItem(makeId(2), makeId(11));

    const items = [makeItem(1), makeItem(2)];
    resolveIncludes(items, ["files"]);

    expect(items[0].files).toHaveLength(2);
    expect(items[1].files).toHaveLength(1);
    expect(items[1].files![0].id).toBe(makeId(11));
  });

  test("resolves content links for items", () => {
    createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });
    createItem({ id: makeId(2), ref: "b", collection: "c", props: {}, changedAt: 200 });
    createItem({ id: makeId(3), ref: "c", collection: "c", props: {}, changedAt: 300 });

    // Content links (prop = null)
    createItemLink({ prop: null, from: makeId(1), to: makeId(2), internal: true });
    createItemLink({ prop: null, from: makeId(1), to: makeId(3), internal: true });
    // Prop link (should NOT appear on item.links)
    createItemLink({ prop: "author", from: makeId(1), to: makeId(3), internal: true });

    const items = [makeItem(1), makeItem(2)];
    resolveIncludes(items, ["links"]);

    // Only content links (prop IS NULL) should be resolved
    expect(items[0].links).toHaveLength(2);
    expect((items[0].links[0] as any).$id).toBe(makeId(2));
    expect((items[0].links[1] as any).$id).toBe(makeId(3));
    expect(items[1].links).toEqual([]);
  });

  test("resolves external content links as URL strings", () => {
    createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });

    // External content link
    const url = "https://example.com/page";
    createItemLink({
      prop: null,
      from: makeId(1),
      to: Buffer.from(url, "utf8").toString("base64url"),
      internal: false,
    });

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
    createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });

    const items = [makeItem(1)];
    resolveIncludes(items, ["files"]);

    expect(items[0].files).toEqual([]);
  });

  test("content link to missing item returns null", () => {
    createItem({ id: makeId(1), ref: "a", collection: "c", props: {}, changedAt: 100 });

    // Internal content link to non-existent target
    createItemLink({ prop: null, from: makeId(1), to: makeId(99), internal: true });

    const items = [makeItem(1)];
    resolveIncludes(items, ["links"]);

    expect(items[0].links).toHaveLength(1);
    expect(items[0].links[0]).toBeNull();
  });
});
