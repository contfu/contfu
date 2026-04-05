import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { pack } from "msgpackr";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../db/db";
import { collectionTable, connectionTable, flowTable, syncJobTable, userTable } from "../db/schema";
import { SyncWorkerManager } from "./worker-manager";
import { and, eq } from "drizzle-orm";

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

describe("SyncWorkerManager schema rename detection", () => {
  let userId: number;
  let sourceCollectionId: number;
  let targetCollectionId: number;
  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "rename-detection@test.com" })
      .returning();
    userId = user.id;

    const [cmsConn] = await db
      .insert(connectionTable)
      .values({ userId, name: "CMS", type: ConnectionType.STRAPI })
      .returning();

    const [clientConn] = await db
      .insert(connectionTable)
      .values({ userId, name: "Client", type: ConnectionType.APP })
      .returning();

    const [sourceCol] = await db
      .insert(collectionTable)
      .values({
        userId,
        connectionId: cmsConn.id,
        name: "articles",
        displayName: "Articles",
        schema: pack({ title: 1, body: 2 }),
      })
      .returning();
    sourceCollectionId = sourceCol.id;

    const [targetCol] = await db
      .insert(collectionTable)
      .values({
        userId,
        connectionId: clientConn.id,
        name: "articles",
        displayName: "Articles",
        schema: pack({ title: 1, body: 2 }),
      })
      .returning();
    targetCollectionId = targetCol.id;
  });

  it("passes empty renames on first broadcast", async () => {
    await db
      .insert(flowTable)
      .values({ userId, sourceId: sourceCollectionId, targetId: targetCollectionId });

    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    await manager.broadcastSchema(userId, targetCollectionId);

    const [, , , , , renames] = schemaCallback.mock.calls[0] as unknown as [
      number,
      number,
      string,
      string,
      Record<string, number>,
      Record<string, string>,
    ];
    expect(renames).toEqual({});
  });

  it("detects a Contfu-level rename and passes it to schemaCallback", async () => {
    // Flow with mapping: source "title" → target "heading"
    const mappings = pack([
      { source: "title", target: "heading" },
      { source: "body", target: "body" },
    ]);
    await db.insert(flowTable).values({
      userId,
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
      mappings,
    });

    const manager = new SyncWorkerManager();
    const schemaCallback = mock(() => {});
    manager.onSchema(schemaCallback);

    // First broadcast: no mapping (identity)
    // Temporarily set the flow without mappings for the initial state
    await db
      .update(flowTable)
      .set({ mappings: null })
      .where(
        and(eq(flowTable.sourceId, sourceCollectionId), eq(flowTable.targetId, targetCollectionId)),
      );

    await manager.broadcastSchema(userId, targetCollectionId);
    expect(schemaCallback).toHaveBeenCalledTimes(1);

    // Now apply the rename mapping
    await db
      .update(flowTable)
      .set({ mappings })
      .where(
        and(eq(flowTable.sourceId, sourceCollectionId), eq(flowTable.targetId, targetCollectionId)),
      );

    await manager.broadcastSchema(userId, targetCollectionId);
    expect(schemaCallback).toHaveBeenCalledTimes(2);

    const [, , , , , renames] = schemaCallback.mock.calls[1] as unknown as [
      number,
      number,
      string,
      string,
      Record<string, number>,
      Record<string, string>,
    ];
    expect(renames).toEqual({ title: "heading" });
  });

  it("does not trigger a snapshot on first broadcast (no previous)", async () => {
    await db
      .insert(flowTable)
      .values({ userId, sourceId: sourceCollectionId, targetId: targetCollectionId });

    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    await manager.broadcastSchema(userId, targetCollectionId);

    const jobs = await db.select().from(syncJobTable);
    expect(jobs).toHaveLength(0);
  });

  it("enqueues snapshot on first broadcast when hints contain additions", async () => {
    await db
      .insert(flowTable)
      .values({ userId, sourceId: sourceCollectionId, targetId: targetCollectionId });

    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    // No previous cache entry — hints bypass the guard and trigger a snapshot
    await manager.broadcastSchema(userId, targetCollectionId, {
      additions: ["title"],
      removals: [],
      renames: {},
    });
    await new Promise((r) => setTimeout(r, 50));

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
  });

  it("enqueues snapshot when new properties are added", async () => {
    await db
      .insert(flowTable)
      .values({ userId, sourceId: sourceCollectionId, targetId: targetCollectionId });

    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    // First broadcast establishes baseline
    await manager.broadcastSchema(userId, targetCollectionId);

    // Add a new property to the source schema
    await db
      .update(collectionTable)
      .set({ schema: pack({ title: 1, body: 2, tags: 4 }) })
      .where(eq(collectionTable.id, sourceCollectionId));

    await manager.broadcastSchema(userId, targetCollectionId);
    // triggerConsumerSnapshot is fire-and-forget; wait for it to settle
    await new Promise((r) => setTimeout(r, 50));

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
  });

  it("does not enqueue snapshot when only a rename occurs", async () => {
    const initialMappings = pack([
      { source: "title", target: "title" },
      { source: "body", target: "body" },
    ]);
    const renameMappings = pack([
      { source: "title", target: "heading" },
      { source: "body", target: "body" },
    ]);

    await db.insert(flowTable).values({
      userId,
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
      mappings: initialMappings,
    });

    const manager = new SyncWorkerManager();
    manager.onSchema(mock(() => {}));

    await manager.broadcastSchema(userId, targetCollectionId);

    // Rename "title" → "heading" via mapping
    await db
      .update(flowTable)
      .set({ mappings: renameMappings })
      .where(
        and(eq(flowTable.sourceId, sourceCollectionId), eq(flowTable.targetId, targetCollectionId)),
      );

    await manager.broadcastSchema(userId, targetCollectionId);

    const jobs = await db.select().from(syncJobTable);
    expect(jobs).toHaveLength(0);
  });
});
