import { beforeEach, describe, expect, test } from "bun:test";
import { createItem } from "../items/createItem";
import { listCollections } from "./listCollections";
import { truncateAllTables } from "../../../test/setup";

function makeId(seed: number): string {
  return Buffer.from([0, 0, 0, seed]).toString("base64url");
}

describe("listCollections", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  test("returns collection summaries with item counts", async () => {
    await createItem({
      id: makeId(1),
      ref: "article/alpha",
      collection: "articles",
      props: { title: "Alpha" },
      changedAt: 100,
    });

    await createItem({
      id: makeId(2),
      ref: "article/bravo",
      collection: "articles",
      props: { title: "Bravo" },
      changedAt: 110,
    });

    await createItem({
      id: makeId(3),
      ref: "guide/charlie",
      collection: "guides",
      props: { title: "Charlie" },
      changedAt: 120,
    });

    const collections = await listCollections();

    expect(collections.map((c) => c.name)).toEqual(["articles", "guides"]);
    expect(collections.find((c) => c.name === "articles")?.itemCount).toBe(2);
    expect(collections.find((c) => c.name === "guides")?.itemCount).toBe(1);
  });
});
