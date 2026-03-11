import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { pack } from "msgpackr";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../db/db";
import { collectionTable, connectionTable, flowTable, syncJobTable, userTable } from "../db/schema";
import { SyncWorkerManager } from "./worker-manager";
import { eq } from "drizzle-orm";

describe("SyncWorkerManager broadcastSchema / resyncCollections", () => {
  let userId: number;
  let targetCollectionId: number;
  let sourceCollectionId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "worker-manager@test.com" })
      .returning();
    userId = user.id;

    const [connection] = await db
      .insert(connectionTable)
      .values({ userId, name: "CMS", type: ConnectionType.STRAPI })
      .returning();

    const schema = pack({ title: 1, body: 2 });
    const [sourceCollection] = await db
      .insert(collectionTable)
      .values({
        userId,
        connectionId: connection.id,
        name: "articles",
        displayName: "Articles",
        schema,
      })
      .returning();
    sourceCollectionId = sourceCollection.id;

    const [targetCollection] = await db
      .insert(collectionTable)
      .values({ userId, name: "articles", displayName: "Articles", schema: pack({}) })
      .returning();
    targetCollectionId = targetCollection.id;

    await db.insert(flowTable).values({
      userId,
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
    });
  });

  it("broadcastSchema calls schemaCallback with merged schema", async () => {
    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    await manager.broadcastSchema(userId, targetCollectionId);

    expect(schemaCallback).toHaveBeenCalledTimes(1);
    const [cbUserId, cbCollectionId, cbName, cbDisplayName, cbSchema] = schemaCallback.mock
      .calls[0] as unknown as [number, number, string, string, Record<string, number>];
    expect(cbUserId).toBe(userId);
    expect(cbCollectionId).toBe(targetCollectionId);
    expect(cbName).toBe("articles");
    expect(cbDisplayName).toBe("Articles");
    expect(cbSchema).toEqual({ title: 1, body: 2 });
  });

  it("broadcastSchema broadcasts even if schema did not change (cache cleared)", async () => {
    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    await manager.broadcastSchema(userId, targetCollectionId);
    await manager.broadcastSchema(userId, targetCollectionId);

    expect(schemaCallback).toHaveBeenCalledTimes(2);
  });

  it("broadcastSchema does not enqueue sync jobs", async () => {
    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    await manager.broadcastSchema(userId, targetCollectionId);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(0);
  });

  it("resyncCollections enqueues a sync job for given collections", async () => {
    const manager = new SyncWorkerManager();

    await manager.resyncCollections([sourceCollectionId]);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("pending");
  });

  it("resyncCollections does not enqueue a duplicate sync job when one is already pending", async () => {
    const manager = new SyncWorkerManager();

    await manager.resyncCollections([sourceCollectionId]);
    await manager.resyncCollections([sourceCollectionId]);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
  });
});
