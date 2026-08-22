import { beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import { db } from "../../infra/db/db";
import {
  collectionsTable,
  fileTable,
  internalLinkTable,
  itemFileTable,
  itemsTable,
  mediaMasterTable,
  mediaVariantTable,
} from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { createItemLink } from "../items/createItemLink";
import { removeCollectionByName } from "./removeCollectionByName";
import { setCollection } from "./setCollection";

const orphanFileId = Buffer.from("orphan-file");
const sharedFileId = Buffer.from("shared-file");

function insertFile(id: Buffer): void {
  db.insert(fileTable)
    .values({
      id,
      status: FileStatus.Ready,
      mediaType: "image",
      meta: {},
      data: Buffer.from("file"),
      createdAt: 1,
    })
    .run();
}

function insertItem(id: number, collection: string): void {
  db.insert(itemsTable).values({ id, collection, changedAt: 1 }).run();
}

describe("removeCollectionByName", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("remove-me", "Remove me", {});
    setCollection("keep-me", "Keep me", {});
    insertItem(1, "remove-me");
    insertItem(2, "remove-me");
    insertItem(3, "keep-me");
  });

  test("removes item links and orphan files while retaining shared files", () => {
    insertFile(orphanFileId);
    insertFile(sharedFileId);
    db.insert(itemFileTable).values({ itemId: 1, fileId: orphanFileId }).run();
    db.insert(itemFileTable).values({ itemId: 2, fileId: sharedFileId }).run();
    db.insert(itemFileTable).values({ itemId: 3, fileId: sharedFileId }).run();
    db.insert(mediaMasterTable)
      .values({
        fileId: orphanFileId,
        mediaType: "image",
        ext: "avif",
        format: "avif",
        configFingerprint: 1,
        metadata: {},
        data: Buffer.from("master"),
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    db.insert(mediaVariantTable)
      .values({
        fileId: orphanFileId,
        ext: "webp",
        optsHash: 1,
        opts: {},
        size: 7,
        data: Buffer.from("variant"),
        createdAt: 1,
      })
      .run();

    createItemLink({ prop: null, from: 3, to: 1 });
    createItemLink({ prop: null, from: 1, to: 2 });

    removeCollectionByName("remove-me");

    expect(
      db
        .select()
        .from(collectionsTable)
        .all()
        .map((row) => row.name),
    ).toEqual(["keep-me"]);
    expect(
      db
        .select()
        .from(itemsTable)
        .all()
        .map((row) => row.id),
    ).toEqual([3]);
    expect(db.select().from(internalLinkTable).all()).toEqual([]);
    expect(
      db
        .select()
        .from(fileTable)
        .all()
        .map((row) => row.id),
    ).toEqual([sharedFileId]);
    expect(db.select().from(itemFileTable).all()).toEqual([{ itemId: 3, fileId: sharedFileId }]);
    expect(db.select().from(mediaMasterTable).all()).toEqual([]);
    expect(db.select().from(mediaVariantTable).all()).toEqual([]);
  });

  test("rolls back all cleanup when collection deletion fails", () => {
    insertFile(orphanFileId);
    db.insert(itemFileTable).values({ itemId: 1, fileId: orphanFileId }).run();
    db.insert(mediaMasterTable)
      .values({
        fileId: orphanFileId,
        mediaType: "image",
        ext: "avif",
        format: "avif",
        configFingerprint: 1,
        metadata: {},
        data: Buffer.from("master"),
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    db.insert(mediaVariantTable)
      .values({
        fileId: orphanFileId,
        ext: "webp",
        optsHash: 1,
        opts: {},
        size: 7,
        data: Buffer.from("variant"),
        createdAt: 1,
      })
      .run();
    createItemLink({ prop: null, from: 3, to: 1 });
    db.run(
      sql.raw(
        "CREATE TRIGGER fail_remove_collection BEFORE DELETE ON collections WHEN OLD.name = 'remove-me' BEGIN SELECT RAISE(ABORT, 'remove failed'); END",
      ),
    );

    try {
      expect(() => removeCollectionByName("remove-me")).toThrow("remove failed");
    } finally {
      db.run(sql.raw("DROP TRIGGER fail_remove_collection"));
    }

    expect(db.select().from(collectionsTable).all()).toHaveLength(2);
    expect(
      db
        .select()
        .from(itemsTable)
        .all()
        .map((row) => row.id)
        .sort(),
    ).toEqual([1, 2, 3]);
    expect(db.select().from(internalLinkTable).all()).toHaveLength(1);
    expect(db.select().from(fileTable).all()).toHaveLength(1);
    expect(db.select().from(itemFileTable).all()).toHaveLength(1);
    expect(db.select().from(itemFileTable).where(eq(itemFileTable.itemId, 1)).all()).toHaveLength(
      1,
    );
    expect(db.select().from(mediaMasterTable).all()).toHaveLength(1);
    expect(db.select().from(mediaVariantTable).all()).toHaveLength(1);
  });
});
