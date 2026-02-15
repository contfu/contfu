import { beforeEach, describe, expect, it } from "bun:test";
import { FilterOperator, SourceType, type Filter } from "@contfu/core";
import { pack } from "msgpackr";
import crypto from "node:crypto";
import { encryptCredentials } from "../../infra/crypto/credentials";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  db,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/db";
import { truncateAllTables } from "../../../test/setup";
import { getConsumerSyncConfig } from "./getConsumerSyncConfig";

const isDbMocked = typeof db.delete !== "function";

/**
 * Creates a full entity chain: source → sourceCollection → collection → influx → consumer → connection.
 * Returns all generated IDs for assertions.
 */
async function createFullChain(opts: {
  userId: number;
  sourceId?: number;
  sourceType?: number;
  sourceUrl?: string | null;
  credentials?: Buffer | null;
  sourceCollectionId?: number;
  collectionRef?: Buffer | null;
  collectionId?: number;
  collectionName?: string;
  consumerId?: number;
  consumerKey?: Buffer;
  influxId?: number;
  filters?: Buffer | null;
}) {
  const sourceId = opts.sourceId ?? 1;
  const sourceCollectionId = opts.sourceCollectionId ?? 1;
  const collectionId = opts.collectionId ?? 1;
  const consumerId = opts.consumerId ?? 1;
  const influxId = opts.influxId ?? 1;

  await db
    .insert(sourceTable)
    .values({
      userId: opts.userId,
      id: sourceId,
      uid: crypto.randomUUID(),
      name: "Source",
      type: opts.sourceType ?? SourceType.STRAPI,
      url: opts.sourceUrl ?? null,
      credentials: opts.credentials ?? null,
    })
    .onConflictDoNothing();

  await db
    .insert(sourceCollectionTable)
    .values({
      userId: opts.userId,
      sourceId,
      id: sourceCollectionId,
      name: "SourceCollection",
      ref: opts.collectionRef ?? null,
    })
    .onConflictDoNothing();

  await db
    .insert(collectionTable)
    .values({
      userId: opts.userId,
      id: collectionId,
      name: opts.collectionName ?? "Collection",
    })
    .onConflictDoNothing();

  await db
    .insert(influxTable)
    .values({
      userId: opts.userId,
      id: influxId,
      collectionId,
      sourceCollectionId,
      schema: null,
      filters: opts.filters ?? null,
    })
    .onConflictDoNothing();

  await db
    .insert(consumerTable)
    .values({
      userId: opts.userId,
      id: consumerId,
      name: "Consumer",
      key: opts.consumerKey ?? Buffer.alloc(32, 0xab),
    })
    .onConflictDoNothing();

  await db
    .insert(connectionTable)
    .values({
      userId: opts.userId,
      consumerId,
      collectionId,
    })
    .onConflictDoNothing();

  return { sourceId, sourceCollectionId, collectionId, consumerId, influxId };
}

describe.skipIf(isDbMocked)("getConsumerSyncConfig", () => {
  let testUserId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "sync-test@test.com" })
      .returning();
    testUserId = user.id;
  });

  it("consumer with no connections → empty collectionIds and sourceGroups", async () => {
    await db.insert(consumerTable).values({
      userId: testUserId,
      id: 1,
      name: "Disconnected Consumer",
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.userId).toBe(testUserId);
    expect(config.collectionIds).toEqual([]);
    expect(config.sourceGroups).toEqual([]);
  });

  it("connected to collection but no influxes → empty sourceGroups", async () => {
    await db.insert(collectionTable).values({
      userId: testUserId,
      id: 1,
      name: "Empty Collection",
    });
    await db.insert(consumerTable).values({
      userId: testUserId,
      id: 1,
      name: "Consumer",
    });
    await db.insert(connectionTable).values({
      userId: testUserId,
      consumerId: 1,
      collectionId: 1,
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.collectionIds).toEqual([1]);
    expect(config.sourceGroups).toEqual([]);
  });

  it("one influx, full chain → correct sourceType, decrypted credentials, collectionRef", async () => {
    const plainCredentials = Buffer.from("my-secret-token");
    const encryptedCreds = await encryptCredentials(testUserId, plainCredentials);
    const collectionRef = Buffer.from("api::article.article");

    await createFullChain({
      userId: testUserId,
      sourceType: SourceType.STRAPI,
      sourceUrl: "https://strapi.example.com",
      credentials: encryptedCreds,
      collectionRef,
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.collectionIds).toEqual([1]);
    expect(config.sourceGroups).toHaveLength(1);

    const group = config.sourceGroups[0];
    expect(group.sourceType).toBe(SourceType.STRAPI);
    expect(group.sourceUrl).toBe("https://strapi.example.com");
    // Round-trip: encrypted in DB, decrypted by getConsumerSyncConfig
    expect(group.credentials).toEqual(plainCredentials);

    expect(group.sourceCollections).toHaveLength(1);
    expect(group.sourceCollections[0].collectionRef).toEqual(collectionRef);
    expect(group.sourceCollections[0].targets).toEqual([{ collectionId: 1, filters: null }]);
  });

  it("two sourceCollections from same source → grouped into 1 sourceGroup", async () => {
    // Source 1 with two source collections
    await db.insert(sourceTable).values({
      userId: testUserId,
      id: 1,
      uid: crypto.randomUUID(),
      name: "Strapi",
      type: SourceType.STRAPI,
    });
    await db.insert(sourceCollectionTable).values([
      { userId: testUserId, sourceId: 1, id: 1, name: "Articles" },
      { userId: testUserId, sourceId: 1, id: 2, name: "Pages" },
    ]);
    await db.insert(collectionTable).values([
      { userId: testUserId, id: 1, name: "Articles Collection" },
      { userId: testUserId, id: 2, name: "Pages Collection" },
    ]);
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        id: 2,
        collectionId: 2,
        sourceCollectionId: 2,
        schema: null,
        filters: null,
      },
    ]);
    await db.insert(consumerTable).values({
      userId: testUserId,
      id: 1,
      name: "Consumer",
      key: Buffer.alloc(32, 0xab),
    });
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: 1, collectionId: 1 },
      { userId: testUserId, consumerId: 1, collectionId: 2 },
    ]);

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.collectionIds).toHaveLength(2);
    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(2);
  });

  it("two different sources → 2 sourceGroups", async () => {
    await db.insert(sourceTable).values([
      {
        userId: testUserId,
        id: 1,
        uid: crypto.randomUUID(),
        name: "Strapi",
        type: SourceType.STRAPI,
      },
      {
        userId: testUserId,
        id: 2,
        uid: crypto.randomUUID(),
        name: "Notion",
        type: SourceType.NOTION,
      },
    ]);
    await db.insert(sourceCollectionTable).values([
      { userId: testUserId, sourceId: 1, id: 1, name: "Articles" },
      { userId: testUserId, sourceId: 2, id: 2, name: "Notes" },
    ]);
    await db.insert(collectionTable).values([
      { userId: testUserId, id: 1, name: "Articles" },
      { userId: testUserId, id: 2, name: "Notes" },
    ]);
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        id: 2,
        collectionId: 2,
        sourceCollectionId: 2,
        schema: null,
        filters: null,
      },
    ]);
    await db.insert(consumerTable).values({
      userId: testUserId,
      id: 1,
      name: "Consumer",
      key: Buffer.alloc(32, 0xab),
    });
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: 1, collectionId: 1 },
      { userId: testUserId, consumerId: 1, collectionId: 2 },
    ]);

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.sourceGroups).toHaveLength(2);
    const types = config.sourceGroups.map((g) => g.sourceType).sort();
    expect(types).toEqual([SourceType.NOTION, SourceType.STRAPI]);
  });

  it("fan-out: one sourceCollection → two target collections", async () => {
    await db.insert(sourceTable).values({
      userId: testUserId,
      id: 1,
      uid: crypto.randomUUID(),
      name: "Strapi",
      type: SourceType.STRAPI,
    });
    await db.insert(sourceCollectionTable).values({
      userId: testUserId,
      sourceId: 1,
      id: 1,
      name: "Articles",
    });
    await db.insert(collectionTable).values([
      { userId: testUserId, id: 1, name: "Published" },
      { userId: testUserId, id: 2, name: "Drafts" },
    ]);
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        id: 2,
        collectionId: 2,
        sourceCollectionId: 1,
        schema: null,
        filters: null,
      },
    ]);
    await db.insert(consumerTable).values({
      userId: testUserId,
      id: 1,
      name: "Consumer",
      key: Buffer.alloc(32, 0xab),
    });
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: 1, collectionId: 1 },
      { userId: testUserId, consumerId: 1, collectionId: 2 },
    ]);

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections[0].targets).toHaveLength(2);

    const targetCollectionIds = config.sourceGroups[0].sourceCollections[0].targets
      .map((t) => t.collectionId)
      .sort();
    expect(targetCollectionIds).toEqual([1, 2]);
  });

  it("filters deserialized correctly", async () => {
    const filters: Filter[] = [
      { property: "status", operator: FilterOperator.EQ, value: "published" },
      { property: "rating", operator: FilterOperator.GTE, value: 4 },
    ];

    await createFullChain({
      userId: testUserId,
      filters: Buffer.from(pack(filters)),
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    const target = config.sourceGroups[0].sourceCollections[0].targets[0];
    expect(target.filters).toEqual(filters);
  });

  it("null credentials → sourceGroup.credentials is null", async () => {
    await createFullChain({
      userId: testUserId,
      credentials: null,
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.sourceGroups[0].credentials).toBeNull();
  });

  it("consumer only sees own collections", async () => {
    // Collection 1 — connected to consumer 1
    await createFullChain({
      userId: testUserId,
      sourceId: 1,
      sourceCollectionId: 1,
      collectionId: 1,
      collectionName: "Connected",
      consumerId: 1,
      influxId: 1,
    });

    // Collection 2 — NOT connected to consumer 1
    await db.insert(collectionTable).values({
      userId: testUserId,
      id: 2,
      name: "Not Connected",
    });
    await db.insert(sourceCollectionTable).values({
      userId: testUserId,
      sourceId: 1,
      id: 2,
      name: "Other SC",
    });
    await db.insert(influxTable).values({
      userId: testUserId,
      id: 2,
      collectionId: 2,
      sourceCollectionId: 2,
      schema: null,
      filters: null,
    });

    const config = await getConsumerSyncConfig(testUserId, 1);

    expect(config.collectionIds).toEqual([1]);
    // Only the influx for collection 1 should appear
    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections[0].targets).toEqual([
      { collectionId: 1, filters: null },
    ]);
  });
});
