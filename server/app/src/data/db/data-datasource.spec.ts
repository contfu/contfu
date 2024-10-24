import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createAccount, createConsumer } from "../../access/access-repository";
import { consumer, DbAccount, DbConsumer } from "../../access/db/access-schema";
import { withSchema } from "../../core/db/db";
import { SourceType } from "../data";
import {
  countConnectionsForConsumer,
  createCollection,
  createConnection,
  createItemIdConflictResolution,
  createSource,
  getItemId,
} from "./data-datasource";
import {
  collection,
  connection,
  itemIdConflictResolution,
  source,
} from "./data-schema";

const db = withSchema({
  source,
  consumer,
  collection,
  connection,
  itemIdConflictResolution,
});

let a: DbAccount;
let cl: DbConsumer;

beforeEach(async () => {
  a = await createAccount("test@test.com");
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
      where: eq(source.id, s.id),
    });
    expect(s).toEqual({
      id: s.id,
      accountId: a.id,
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
      where: eq(collection.id, c.id),
    });
    expect(c).toEqual({
      id: c.id,
      accountId: a.id,
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
        eq(connection.accountId, a.id),
        eq(connection.consumerId, cl.id),
        eq(connection.collectionId, c.id)
      ),
    });
    expect(cc).toEqual({
      accountId: a.id,
      consumerId: cl.id,
      collectionId: c.id,
      lastItemChanged: null,
      lastConsistencyCheck: null,
    });
    expect(stored).toEqual(cc);
  });
});

describe("countConnectionsForConsumer()", async () => {
  it("should return the count of connections for a consumer", async () => {
    const s = await createSource(a.id, {
      type: SourceType.NOTION,
      name: "test",
      credentials: Buffer.from("test", "base64url"),
    });
    const c1 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const c2 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const c3 = await createCollection(a.id, s.id, "test", Buffer.alloc(0));
    const cl = await createConsumer(a.id, "test");
    await createConnection(a.id, cl.id, c1.id);
    await createConnection(a.id, cl.id, c2.id);
    await createConnection(a.id, cl.id, c3.id);

    const count = await countConnectionsForConsumer(a.id, cl.id);

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
      where: eq(itemIdConflictResolution.id, 1),
    });
    expect(stored).toEqual({
      accountId: a.id,
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
