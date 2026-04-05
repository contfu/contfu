import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { pack } from "msgpackr";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  syncJobTable,
  userTable,
} from "../../infra/db/schema";
import { triggerConsumerSnapshot, triggerSnapshotForCollection } from "./triggerConsumerSnapshot";
import { eq } from "drizzle-orm";

describe("triggerConsumerSnapshot", () => {
  let userId: number;
  let consumerId: number;
  let targetCollectionId: number;
  let sourceCollectionId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test", email: "trigger-snapshot@test.com" })
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
    consumerId = clientConn.id;

    const [sourceCol] = await db
      .insert(collectionTable)
      .values({
        userId,
        connectionId: cmsConn.id,
        name: "articles",
        displayName: "Articles",
        schema: pack({ title: 1 }),
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
        schema: pack({ title: 1 }),
      })
      .returning();
    targetCollectionId = targetCol.id;

    await db.insert(flowTable).values({
      userId,
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
    });
  });

  it("enqueues sync jobs for source collections feeding the target", async () => {
    await triggerConsumerSnapshot(userId, consumerId, targetCollectionId);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("pending");
  });

  it("does not enqueue duplicate sync job when one is already pending", async () => {
    await triggerConsumerSnapshot(userId, consumerId, targetCollectionId);
    await triggerConsumerSnapshot(userId, consumerId, targetCollectionId);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
  });

  it("does nothing when no flows feed the target collection", async () => {
    const [otherCol] = await db
      .insert(collectionTable)
      .values({ userId, name: "other", displayName: "Other", schema: pack({}) })
      .returning();

    await triggerConsumerSnapshot(userId, consumerId, otherCol.id);

    const jobs = await db.select().from(syncJobTable);
    expect(jobs).toHaveLength(0);
  });
});

describe("triggerSnapshotForCollection", () => {
  let userId: number;
  let sourceCollectionId: number;
  let targetCollectionId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test", email: "trigger-snapshot-collection@test.com" })
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
        schema: pack({ title: 1 }),
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
        schema: pack({ title: 1 }),
      })
      .returning();
    targetCollectionId = targetCol.id;

    await db.insert(flowTable).values({
      userId,
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
    });
  });

  it("enqueues sync jobs for the source collections via the CLIENT consumer", async () => {
    await triggerSnapshotForCollection(userId, targetCollectionId);

    const jobs = await db
      .select()
      .from(syncJobTable)
      .where(eq(syncJobTable.collectionId, sourceCollectionId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("pending");
  });

  it("does nothing when the collection has no CLIENT connection", async () => {
    const [unlinkedCol] = await db
      .insert(collectionTable)
      .values({ userId, name: "unlinked", displayName: "Unlinked", schema: pack({}) })
      .returning();

    await triggerSnapshotForCollection(userId, unlinkedCol.id);

    const jobs = await db.select().from(syncJobTable);
    expect(jobs).toHaveLength(0);
  });
});
