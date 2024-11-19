import {
  collectionTable,
  connectionTable,
  Consumer,
  db,
  itemIdConflictResolutionTable,
  sourceTable,
  User,
} from "@contfu/db";
import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createConsumer, createUser } from "../../access/access-repository";
import { SourceType } from "../data";
import {
  countCollectionsForConsumer,
  createCollection,
  createConnection,
  createItemIdConflictResolution,
  createSource,
  getItemId,
} from "./data-datasource";

let a: User;
let cl: Consumer;

beforeEach(async () => {
  a = await createUser("test@test.com", "test");
  cl = await createConsumer(a.id, "test");
});

describe("createSource()", () => {
  it("should create a source in the database and return it", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });

    const stored = await db.query.source.findFirst({
      where: eq(sourceTable.id, s.id),
    });
    expect(s).toEqual({
      id: s.id,
      userId: a.id,
      name: "test",
      type: SourceType.NOTION,
      credentials: Buffer.from("test", "base64url"),
      url: null,
      createdAt: expect.any(Number),
      updatedAt: null,
    });
    expect(s).toEqual(stored!);
  });
});

describe("createCollection()", () => {
  it("should create a collection in the database and return it", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });

    const c = await createCollection(a.id, s.id, "test", Buffer.alloc(0));

    const stored = await db.query.collection.findFirst({
      where: eq(collectionTable.id, c.id),
    });
    expect(c).toEqual({
      id: c.id,
      userId: a.id,
      sourceId: s.id,
      name: "test",
      ref: Buffer.alloc(0),
      createdAt: expect.any(Number),
      updatedAt: null,
      itemIds: null,
    });
    expect(c).toEqual(stored!);
  });
});

describe("createConnection()", () => {
  it("should create a consumer collection connection in the database", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const cl = await createConsumer(a.id, "test");

    const cc = await createConnection(a.id, cl.id, c.id);

    const stored = await db.query.connection.findFirst({
      where: and(
        eq(connectionTable.userId, a.id),
        eq(connectionTable.consumerId, cl.id),
        eq(connectionTable.collectionId, c.id),
      ),
    });
    expect(cc).toEqual({
      userId: a.id,
      consumerId: cl.id,
      collectionId: c.id,
      lastItemChanged: null,
      lastConsistencyCheck: null,
    });
    expect(stored).toEqual(cc);
  });
});

describe("countCollectionsForConsumer()", async () => {
  it("should return the distinct count of collections for a consumer", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c1 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const c2 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const c3 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const cl = await createConsumer(a.id, "test");
    const cl2 = await createConsumer(a.id, "test2");
    await createConnection(a.id, cl.id, c1.id);
    await createConnection(a.id, cl.id, c2.id);
    await createConnection(a.id, cl.id, c3.id);
    await createConnection(a.id, cl2.id, c3.id);

    const count = await countCollectionsForConsumer(a.id, cl.id);

    expect(count).toBe(3);
  });
});

describe("createItemIdConflictResolution()", () => {
  it("should create a item id conflict resolution in the database", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test", Buffer.alloc(0));

    await createItemIdConflictResolution(a.id, c.id, Buffer.from([1]), 1);

    const stored = await db.query.itemIdConflictResolution.findFirst({
      where: eq(itemIdConflictResolutionTable.id, 1),
    });
    expect(stored).toEqual({
      userId: a.id,
      collectionId: c.id,
      sourceItemId: Buffer.from([1]),
      id: 1,
    });
  });
});

describe("getItemId()", () => {
  it("should return the item id if it is in the conflict resolution table", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test", Buffer.alloc(0));

    await createItemIdConflictResolution(a.id, c.id, Buffer.from([1]), 1);

    const id = await getItemId(a.id, c.id, Buffer.from([1]));
    expect(id).toEqual(1);
  });

  it("should return the item id derived from the last 4 bytes of the source item id if it is not in the conflict resolution table", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test", Buffer.alloc(0));

    const id = await getItemId(a.id, c.id, Buffer.from([1, 2, 3, 4, 5]));
    expect(id).toEqual(0x05040302);
  });
});
