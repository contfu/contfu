import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../../test/setup";
import { db } from "../infra/db/db";
import { fileTable, itemsTable, mediaVariantTable } from "../infra/db/schema";
import { setCollection } from "./collections/setCollection";
import { countDownloadedFiles, countFiles, countProcessedFiles } from "./files/countFiles";
import { countItems } from "./items/countItems";

function makeId(seed: number): Buffer {
  return Buffer.from([0, 0, 0, seed]);
}

describe("count helpers", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("articles", "Articles", {});
  });

  test("returns numeric item and file counts", () => {
    db.insert(itemsTable)
      .values([
        { id: 1, collection: "articles", changedAt: 100 },
        { id: 2, collection: "articles", changedAt: 200 },
      ])
      .run();

    db.insert(fileTable)
      .values([
        {
          id: makeId(11),
          status: 1,
          mediaType: "image",
          meta: { ext: "png", size: 10 },
          createdAt: 100,
        },
        {
          id: makeId(12),
          status: 2,
          mediaType: "image",
          meta: { ext: "png", size: 20 },
          data: Buffer.from("downloaded"),
          createdAt: 200,
        },
      ])
      .run();

    db.insert(mediaVariantTable)
      .values([
        {
          fileId: makeId(11),
          ext: "webp",
          optsHash: 1,
          opts: {},
          size: 5,
          data: Buffer.from("variant-a"),
          createdAt: 300,
        },
        {
          fileId: makeId(11),
          ext: "avif",
          optsHash: 2,
          opts: {},
          size: 4,
          data: Buffer.from("variant-b"),
          createdAt: 301,
        },
      ])
      .run();

    expect(countItems()).toBe(2);
    expect(countFiles()).toBe(2);
    expect(countDownloadedFiles()).toBe(1);
    expect(countProcessedFiles()).toBe(1);
  });
});
