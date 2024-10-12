import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createAccount, createClient } from "../../access/access-repository";
import { Account, Client } from "../../access/db/access-schema";
import { withSchema } from "../../core/db";
import {
  createClientCollectionConnection,
  createCollection,
  createItemIdConflictResolution,
  createSource,
  getCollectionsForClient,
  getItemId,
} from "./data-datasource";
import {
  clientCollectionConnection,
  collection,
  itemIdConflictResolution,
  source,
} from "./data-schema";

const db = withSchema({
  source,
  clientCollectionConnection,
  collection,
  itemIdConflictResolution,
});

let a: Account;
let cl: Client;

beforeEach(async () => {
  a = await createAccount("test@test.com");
  cl = await createClient(a.id, "test");
});

describe("createSource()", () => {
  it("should create a source in the database and return it", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });

    const stored = await db.query.source.findFirst({
      where: eq(source.id, s.id),
    });
    expect(s).toEqual({
      id: s.id,
      accountId: a.id,
      name: "test",
      type: "notion",
      key: Buffer.from("test", "base64url"),
      opts: {},
      createdAt: expect.any(Date),
      updatedAt: null,
    });
    expect(s).toEqual(stored!);
  });
});

describe("createCollection()", () => {
  it("should create a collection in the database and return it", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });

    const c = await createCollection(a.id, s.id, "test");

    const stored = await db.query.collection.findFirst({
      where: eq(collection.id, c.id),
    });
    expect(c).toEqual({
      id: c.id,
      accountId: a.id,
      sourceId: s.id,
      name: "test",
      opts: null,
      createdAt: expect.any(Date),
      updatedAt: null,
    });
    expect(c).toEqual(stored!);
  });
});

describe("createClientCollectionConnection()", () => {
  it("should create a client collection connection in the database", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test");
    const cl = await createClient(a.id, "test");

    const cc = await createClientCollectionConnection(a.id, cl.id, c.id);

    const stored = await db.query.clientCollectionConnection.findFirst({
      where: and(
        eq(clientCollectionConnection.accountId, a.id),
        eq(clientCollectionConnection.clientId, cl.id),
        eq(clientCollectionConnection.collectionId, c.id)
      ),
    });
    expect(cc).toEqual({
      accountId: a.id,
      clientId: cl.id,
      collectionId: c.id,
      lastItemChanged: null,
      lastFetch: null,
      lastConsistencyCheck: null,
      ids: Buffer.alloc(0),
    });
    expect(stored).toEqual(cc);
  });
});

describe("getCollectionsForClient()", async () => {
  it("should return the collections for a client", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test");
    const cl = await createClient(a.id, "test");
    const cc = await createClientCollectionConnection(a.id, cl.id, c.id);

    const collections = await getCollectionsForClient(a.id, cl.id);

    expect(collections).toEqual([{ ...cc, collection: c }]);
  });
});

describe("createItemIdConflictResolution()", () => {
  it("should create a item id conflict resolution in the database", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test");

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
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test");

    await createItemIdConflictResolution(a.id, c.id, Buffer.from([1]), 1);

    const id = await getItemId(a.id, c.id, Buffer.from([1]));
    expect(id).toEqual(1);
  });

  it("should return the item id derived from the last 4 bytes of the source item id if it is not in the conflict resolution table", async () => {
    const s = await createSource(a.id, "test", {
      type: "notion",
      key: Buffer.from("test", "base64url"),
    });
    const c = await createCollection(a.id, s.id, "test");

    const id = await getItemId(a.id, c.id, Buffer.from([1, 2, 3, 4, 5]));
    expect(id).toEqual(0x05040302);
  });
});
