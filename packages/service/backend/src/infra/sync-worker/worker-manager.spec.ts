import { SourceType } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import crypto from "node:crypto";
import { pack } from "msgpackr";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../db/db";
import {
  collectionTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  syncJobTable,
  userTable,
} from "../db/schema";
import { SyncWorkerManager } from "./worker-manager";
import { eq } from "drizzle-orm";

describe("SyncWorkerManager broadcastSchema / resyncSourceCollections", () => {
  let userId: number;
  let collectionId: number;
  let sourceCollectionId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "worker-manager@test.com" })
      .returning();
    userId = user.id;

    const [collection] = await db
      .insert(collectionTable)
      .values({ userId, name: "articles", displayName: "Articles", schema: pack({}) })
      .returning();
    collectionId = collection.id;

    const [source] = await db
      .insert(sourceTable)
      .values({ userId, uid: crypto.randomUUID(), name: "CMS", type: SourceType.STRAPI })
      .returning();

    const schema = pack({ title: 1, body: 2 });
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({ userId, sourceId: source.id, name: "articles", schema })
      .returning();
    sourceCollectionId = sourceCollection.id;

    await db.insert(influxTable).values({
      userId,
      collectionId,
      sourceCollectionId,
    });
  });

  it("broadcastSchema calls schemaCallback with merged schema", async () => {
    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    await manager.broadcastSchema(userId, collectionId);

    expect(schemaCallback).toHaveBeenCalledTimes(1);
    const [cbUserId, cbCollectionId, cbName, cbDisplayName, cbSchema] = schemaCallback.mock
      .calls[0] as [number, number, string, string, Record<string, number>];
    expect(cbUserId).toBe(userId);
    expect(cbCollectionId).toBe(collectionId);
    expect(cbName).toBe("articles");
    expect(cbDisplayName).toBe("Articles");
    expect(cbSchema).toEqual({ title: 1, body: 2 });
  });

  it("broadcastSchema broadcasts even if schema did not change (cache cleared)", async () => {
    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    await manager.broadcastSchema(userId, collectionId);
    await manager.broadcastSchema(userId, collectionId);

    expect(schemaCallback).toHaveBeenCalledTimes(2);
  });

  it("broadcastSchema does not enqueue sync jobs", async () => {
    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    await manager.broadcastSchema(userId, collectionId);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.sourceCollectionId, sourceCollectionId));
    expect(jobs).toHaveLength(0);
  });

  it("resyncSourceCollections enqueues a sync job for given source collections", async () => {
    const manager = new SyncWorkerManager();

    await manager.resyncSourceCollections([sourceCollectionId]);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.sourceCollectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("pending");
  });

  it("resyncSourceCollections does not enqueue a duplicate sync job when one is already pending", async () => {
    const manager = new SyncWorkerManager();

    await manager.resyncSourceCollections([sourceCollectionId]);
    await manager.resyncSourceCollections([sourceCollectionId]);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.sourceCollectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
  });
});
