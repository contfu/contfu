import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import { db } from "../../infra/db/db";
import { decodeId, encodeId } from "../../infra/ids";
import { fileTable, itemFileTable, itemsTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import { linkFileToItem } from "./linkFileToItem";
import { pruneItemFiles } from "./pruneItemFiles";

const oldFile = "aaaaaaaaaaaaaaaa";
const newFile = "bbbbbbbbbbbbbbbb";

function insertFile(id: string): void {
  db.insert(fileTable)
    .values({
      id: decodeId(id),
      status: FileStatus.Ready,
      mediaType: "image",
      meta: { ext: "avif", size: 1 },
      data: Buffer.from("x"),
      createdAt: 1700000000,
    })
    .run();
}

function linkedIds(itemId: number): string[] {
  return db
    .select({ fileId: itemFileTable.fileId })
    .from(itemFileTable)
    .where(eq(itemFileTable.itemId, itemId))
    .all()
    .map(({ fileId }) => encodeId(Buffer.from(fileId)))
    .sort();
}

describe("pruneItemFiles", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("test", "Test", {});
    db.insert(itemsTable).values({ id: 1, collection: "test", changedAt: 1700000000 }).run();
    db.insert(itemsTable).values({ id: 2, collection: "test", changedAt: 1700000000 }).run();
    insertFile(oldFile);
    insertFile(newFile);
  });

  test("drops the link and the file the item no longer references", () => {
    linkFileToItem(1, oldFile);
    linkFileToItem(1, newFile);

    pruneItemFiles(1, [newFile]);

    expect(linkedIds(1)).toEqual([newFile]);
    expect(db.select().from(fileTable).all()).toHaveLength(1);
  });

  test("keeps a file that another item still links", () => {
    linkFileToItem(1, oldFile);
    linkFileToItem(2, oldFile);

    pruneItemFiles(1, []);

    expect(linkedIds(2)).toEqual([oldFile]);
    expect(db.select().from(fileTable).all()).toHaveLength(2);
  });

  test("leaves untouched an item whose files are all still referenced", () => {
    linkFileToItem(1, oldFile);
    linkFileToItem(1, newFile);

    pruneItemFiles(1, [oldFile, newFile]);

    expect(linkedIds(1)).toEqual([newFile, oldFile].sort());
    expect(db.select().from(fileTable).all()).toHaveLength(2);
  });
});
