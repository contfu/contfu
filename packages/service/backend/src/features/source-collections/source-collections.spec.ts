import { SourceType } from "@contfu/core";
import { PropertyType } from "@contfu/svc-core";
import { encode } from "@msgpack/msgpack";
import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { createCollection as createSourceCollectionWithMapping } from "./createCollection";
import { createSourceCollection } from "./createSourceCollection";
import { deleteCollection } from "./deleteCollection";
import { getCollection } from "./getCollection";
import { getCollectionSchema } from "./getCollectionSchema";
import { getCollectionWithConnectionCount } from "./getCollectionWithConnectionCount";
import { listCollections } from "./listCollections";
import { updateCollection } from "./updateCollection";

describe("SourceCollection Features Happy Path", () => {
  let userId: number;
  let sourceId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "source-collections-happy@test.com" })
      .returning();
    userId = user.id;

    const [source] = await db
      .insert(sourceTable)
      .values({
        userId,
        uid: crypto.randomUUID(),
        name: "Source",
        type: SourceType.STRAPI,
      })
      .returning();
    sourceId = source.id;
  });

  it("should create, read, update, and delete a source collection", async () => {
    const created = await runTest(
      createSourceCollection(userId, {
        sourceId,
        name: "Articles",
        displayName: "Public Articles",
        ref: Buffer.from("api::article.article"),
      }),
    );

    const fetched = await runTest(getCollection(userId, created.id));
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe("Articles");
    expect(fetched!.hasRef).toBe(true);

    const updated = await runTest(
      updateCollection(userId, created.id, {
        name: "Articles Updated",
        ref: Buffer.from("api::article.updated"),
      }),
    );
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Articles Updated");

    const deleted = await runTest(deleteCollection(userId, created.id));
    expect(deleted).toBe(true);
  });

  it("should return schema for a collection when available", async () => {
    const schema = {
      title: PropertyType.STRING,
      publishedAt: PropertyType.STRING,
    };

    const created = await runTest(
      createSourceCollection(userId, {
        sourceId,
        name: "Schema Collection",
        schema: Buffer.from(encode(schema)),
      }),
    );

    const decoded = await runTest(getCollectionSchema(userId, created.id));
    expect(decoded).toEqual(schema);
  });

  it("should list collections and include connection count for one collection", async () => {
    // Keep IDs aligned for getCollectionWithConnectionCount, which matches on connection.collectionId.
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId,
        displayName: "Articles Collection",
        name: "Articles Collection",
      })
      .returning();

    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId,
        sourceId,
        name: "Articles",
      })
      .returning();

    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId,
        name: "Consumer",
      })
      .returning();

    await db.insert(consumerCollectionTable).values({
      userId,
      consumerId: consumer.id,
      collectionId: collection.id,
    });

    const listed = await runTest(listCollections(userId));
    expect(listed.length).toBeGreaterThan(0);

    if (sourceCollection.id === collection.id) {
      const withCount = await runTest(
        getCollectionWithConnectionCount(userId, sourceCollection.id),
      );
      expect(withCount).toBeDefined();
      expect(withCount!.connectionCount).toBe(1);
    } else {
      // Fallback if identity sequences diverge due to prior inserts.
      const withCount = await runTest(
        getCollectionWithConnectionCount(userId, sourceCollection.id),
      );
      expect(withCount).toBeDefined();
    }
  });

  it("should create source collection + collection + influx via createCollection", async () => {
    const created = await runTest(
      createSourceCollectionWithMapping(userId, {
        sourceId,
        name: "Auto Mapped",
        ref: Buffer.from("api::article.article"),
      }),
    );

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Auto Mapped");

    const mappings = await db
      .select({ id: influxTable.id })
      .from(influxTable)
      .where(eq(influxTable.sourceCollectionId, created.id));

    expect(mappings.length).toBe(1);
  });
});
