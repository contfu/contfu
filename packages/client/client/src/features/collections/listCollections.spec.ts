import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "./setCollection";
import { createItem } from "../items/createItem";
import { listCollections } from "./listCollections";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

describe("listCollections", () => {
  beforeEach(() => {
    truncateAllTables();
  });

  test("returns collection summaries with item counts", () => {
    // Create collections first (schema events arrive before items)
    setCollection("articles", "Articles", { title: 1 });
    setCollection("guides", "Guides", { title: 1 });

    createItem({
      id: makeId(1),
      ref: "article/alpha",
      collection: "articles",
      props: { title: "Alpha" },
      changedAt: 100,
    });

    createItem({
      id: makeId(2),
      ref: "article/bravo",
      collection: "articles",
      props: { title: "Bravo" },
      changedAt: 110,
    });

    createItem({
      id: makeId(3),
      ref: "guide/charlie",
      collection: "guides",
      props: { title: "Charlie" },
      changedAt: 120,
    });

    const collections = listCollections();

    expect(collections.map((c) => c.name)).toEqual(["articles", "guides"]);
    expect(collections.find((c) => c.name === "articles")?.itemCount).toBe(2);
    expect(collections.find((c) => c.name === "guides")?.itemCount).toBe(1);
    expect(collections.find((c) => c.name === "articles")?.displayName).toBe("Articles");
  });
});
