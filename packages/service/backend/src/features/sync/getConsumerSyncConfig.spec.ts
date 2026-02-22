import { SourceType } from "@contfu/core";
import { FilterOperator, type Filter } from "@contfu/svc-core";
import { beforeEach, describe, expect, it } from "bun:test";
import { pack } from "msgpackr";
import crypto from "node:crypto";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
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
import { getConsumerSyncConfig } from "./getConsumerSyncConfig";

const isDbMocked = typeof db.delete !== "function";

/**
 * Creates a full entity chain: source → sourceCollection → collection → influx → consumer → connection.
 * Returns all generated IDs for assertions.
 */
async function createFullChain(opts: {
  userId: number;
  sourceType?: number;
  sourceUrl?: string | null;
  credentials?: Buffer | null;
  collectionRef?: Buffer | null;
  collectionName?: string;
  consumerKey?: Buffer;
  filters?: Buffer | null;
}) {
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId: opts.userId,
      uid: crypto.randomUUID(),
      name: "Source",
      type: opts.sourceType ?? SourceType.STRAPI,
      url: opts.sourceUrl ?? null,
      credentials: opts.credentials ?? null,
    })
    .returning();

  const [sourceCollection] = await db
    .insert(sourceCollectionTable)
    .values({
      userId: opts.userId,
      sourceId: source.id,
      name: "SourceCollection",
      ref: opts.collectionRef ?? null,
    })
    .returning();

  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId: opts.userId,
      name: opts.collectionName ?? "Collection",
    })
    .returning();

  const [influx] = await db
    .insert(influxTable)
    .values({
      userId: opts.userId,
      collectionId: collection.id,
      sourceCollectionId: sourceCollection.id,
      schema: null,
      filters: opts.filters ?? null,
    })
    .returning();

  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId: opts.userId,
      name: "Consumer",
      key: opts.consumerKey ?? Buffer.alloc(32, 0xab),
    })
    .returning();

  await db
    .insert(connectionTable)
    .values({
      userId: opts.userId,
      consumerId: consumer.id,
      collectionId: collection.id,
    })
    .onConflictDoNothing();

  return {
    sourceId: source.id,
    sourceCollectionId: sourceCollection.id,
    collectionId: collection.id,
    consumerId: consumer.id,
    influxId: influx.id,
  };
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
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: testUserId,
        name: "Disconnected Consumer",
      })
      .returning();

    const config = await runTest(getConsumerSyncConfig(testUserId, consumer.id));

    expect(config.userId).toBe(testUserId);
    expect(config.collectionIds).toEqual([]);
    expect(config.sourceGroups).toEqual([]);
  });

  it("connected to collection but no influxes → empty sourceGroups", async () => {
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        name: "Empty Collection",
      })
      .returning();
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: testUserId,
        name: "Consumer",
      })
      .returning();
    await db.insert(connectionTable).values({
      userId: testUserId,
      consumerId: consumer.id,
      collectionId: collection.id,
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, consumer.id));

    expect(config.collectionIds).toEqual([collection.id]);
    expect(config.sourceGroups).toEqual([]);
  });

  it("one influx, full chain → correct sourceType, decrypted credentials, collectionRef", async () => {
    const plainCredentials = Buffer.from("my-secret-token");
    const encryptedCreds = await encryptCredentials(testUserId, plainCredentials);
    const collectionRef = Buffer.from("api::article.article");

    const chain = await createFullChain({
      userId: testUserId,
      sourceType: SourceType.STRAPI,
      sourceUrl: "https://strapi.example.com",
      credentials: encryptedCreds,
      collectionRef,
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, chain.consumerId));

    expect(config.collectionIds).toEqual([chain.collectionId]);
    expect(config.sourceGroups).toHaveLength(1);

    const group = config.sourceGroups[0];
    expect(group.sourceType).toBe(SourceType.STRAPI);
    expect(group.sourceUrl).toBe("https://strapi.example.com");
    // Round-trip: encrypted in DB, decrypted by getConsumerSyncConfig
    expect(group.credentials).toEqual(plainCredentials);

    expect(group.sourceCollections).toHaveLength(1);
    expect(group.sourceCollections[0].collectionRef).toEqual(collectionRef);
    expect(group.sourceCollections[0].targets).toEqual([
      { collectionId: chain.collectionId, filters: null, includeRef: true },
    ]);
  });

  it("two sourceCollections from same source → grouped into 1 sourceGroup", async () => {
    // Source 1 with two source collections
    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: testUserId,
        uid: crypto.randomUUID(),
        name: "Strapi",
        type: SourceType.STRAPI,
      })
      .returning();
    const [sourceCollection1, sourceCollection2] = await db
      .insert(sourceCollectionTable)
      .values([
        { userId: testUserId, sourceId: source.id, name: "Articles" },
        { userId: testUserId, sourceId: source.id, name: "Pages" },
      ])
      .returning();
    const [collection1, collection2] = await db
      .insert(collectionTable)
      .values([
        { userId: testUserId, name: "Articles Collection" },
        { userId: testUserId, name: "Pages Collection" },
      ])
      .returning();
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        collectionId: collection1.id,
        sourceCollectionId: sourceCollection1.id,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        collectionId: collection2.id,
        sourceCollectionId: sourceCollection2.id,
        schema: null,
        filters: null,
      },
    ]);
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: testUserId,
        name: "Consumer",
        key: Buffer.alloc(32, 0xab),
      })
      .returning();
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: consumer.id, collectionId: collection1.id },
      { userId: testUserId, consumerId: consumer.id, collectionId: collection2.id },
    ]);

    const config = await runTest(getConsumerSyncConfig(testUserId, consumer.id));

    expect(config.collectionIds).toHaveLength(2);
    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(2);
  });

  it("two different sources → 2 sourceGroups", async () => {
    const [source1, source2] = await db
      .insert(sourceTable)
      .values([
        {
          userId: testUserId,
          uid: crypto.randomUUID(),
          name: "Strapi",
          type: SourceType.STRAPI,
        },
        {
          userId: testUserId,
          uid: crypto.randomUUID(),
          name: "Notion",
          type: SourceType.NOTION,
        },
      ])
      .returning();
    const [sourceCollection1, sourceCollection2] = await db
      .insert(sourceCollectionTable)
      .values([
        { userId: testUserId, sourceId: source1.id, name: "Articles" },
        { userId: testUserId, sourceId: source2.id, name: "Notes" },
      ])
      .returning();
    const [collection1, collection2] = await db
      .insert(collectionTable)
      .values([
        { userId: testUserId, name: "Articles" },
        { userId: testUserId, name: "Notes" },
      ])
      .returning();
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        collectionId: collection1.id,
        sourceCollectionId: sourceCollection1.id,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        collectionId: collection2.id,
        sourceCollectionId: sourceCollection2.id,
        schema: null,
        filters: null,
      },
    ]);
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: testUserId,
        name: "Consumer",
        key: Buffer.alloc(32, 0xab),
      })
      .returning();
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: consumer.id, collectionId: collection1.id },
      { userId: testUserId, consumerId: consumer.id, collectionId: collection2.id },
    ]);

    const config = await runTest(getConsumerSyncConfig(testUserId, consumer.id));

    expect(config.sourceGroups).toHaveLength(2);
    const types = config.sourceGroups.map((g) => g.sourceType).sort();
    expect(types).toEqual([SourceType.NOTION, SourceType.STRAPI]);
  });

  it("fan-out: one sourceCollection → two target collections", async () => {
    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: testUserId,
        uid: crypto.randomUUID(),
        name: "Strapi",
        type: SourceType.STRAPI,
      })
      .returning();
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId: testUserId,
        sourceId: source.id,
        name: "Articles",
      })
      .returning();
    const [collection1, collection2] = await db
      .insert(collectionTable)
      .values([
        { userId: testUserId, name: "Published" },
        { userId: testUserId, name: "Drafts" },
      ])
      .returning();
    await db.insert(influxTable).values([
      {
        userId: testUserId,
        collectionId: collection1.id,
        sourceCollectionId: sourceCollection.id,
        schema: null,
        filters: null,
      },
      {
        userId: testUserId,
        collectionId: collection2.id,
        sourceCollectionId: sourceCollection.id,
        schema: null,
        filters: null,
      },
    ]);
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: testUserId,
        name: "Consumer",
        key: Buffer.alloc(32, 0xab),
      })
      .returning();
    await db.insert(connectionTable).values([
      { userId: testUserId, consumerId: consumer.id, collectionId: collection1.id },
      { userId: testUserId, consumerId: consumer.id, collectionId: collection2.id },
    ]);

    const config = await runTest(getConsumerSyncConfig(testUserId, consumer.id));

    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections[0].targets).toHaveLength(2);

    const targetCollectionIds = config.sourceGroups[0].sourceCollections[0].targets
      .map((t) => t.collectionId)
      .sort();
    expect(targetCollectionIds).toEqual([collection1.id, collection2.id].sort());
  });

  it("filters deserialized correctly", async () => {
    const filters: Filter[] = [
      { property: "status", operator: FilterOperator.EQ, value: "published" },
      { property: "rating", operator: FilterOperator.GTE, value: 4 },
    ];

    const chain = await createFullChain({
      userId: testUserId,
      filters: Buffer.from(pack(filters)),
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, chain.consumerId));

    const target = config.sourceGroups[0].sourceCollections[0].targets[0];
    expect(target.filters).toEqual(filters);
  });

  it("null credentials → sourceGroup.credentials is null", async () => {
    const chain = await createFullChain({
      userId: testUserId,
      credentials: null,
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, chain.consumerId));

    expect(config.sourceGroups[0].credentials).toBeNull();
  });

  it("consumer only sees own collections", async () => {
    // Collection 1 — connected to consumer 1
    const chain1 = await createFullChain({
      userId: testUserId,
      collectionName: "Connected",
    });

    // Collection 2 — NOT connected to consumer 1
    const [collection2] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        name: "Not Connected",
      })
      .returning();
    const [sourceCollection2] = await db
      .insert(sourceCollectionTable)
      .values({
        userId: testUserId,
        sourceId: chain1.sourceId,
        name: "Other SC",
      })
      .returning();
    await db.insert(influxTable).values({
      userId: testUserId,
      collectionId: collection2.id,
      sourceCollectionId: sourceCollection2.id,
      schema: null,
      filters: null,
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, chain1.consumerId));

    expect(config.collectionIds).toEqual([chain1.collectionId]);
    // Only the influx for collection 1 should appear
    expect(config.sourceGroups).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections).toHaveLength(1);
    expect(config.sourceGroups[0].sourceCollections[0].targets).toEqual([
      { collectionId: chain1.collectionId, filters: null, includeRef: true },
    ]);
  });

  it("should return empty config when requesting another user's consumer", async () => {
    const [user2] = await db
      .insert(userTable)
      .values({ name: "User 2", email: "sync-user2@test.com" })
      .returning();

    const chain = await createFullChain({
      userId: user2.id,
    });

    const config = await runTest(getConsumerSyncConfig(testUserId, chain.consumerId));

    expect(config.userId).toBe(testUserId);
    expect(config.collectionIds).toEqual([]);
    expect(config.sourceGroups).toEqual([]);
  });
});
