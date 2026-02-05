import { describe, expect, it, beforeEach } from "bun:test";
import { db } from "../../infra/db/db";
import {
  userTable,
  consumerTable,
  sourceTable,
  sourceCollectionTable,
  collectionTable,
  influxTable,
} from "../../infra/db/schema";
import { createConnection } from "./createConnection";
import { SourceType } from "@contfu/core";

describe("createConnection", () => {
  beforeEach(async () => {
    // Clean up tables in correct order (respecting foreign keys)
    await db.delete(influxTable);
    await db.delete(collectionTable);
    await db.delete(sourceCollectionTable);
    await db.delete(consumerTable);
    await db.delete(sourceTable);
    await db.delete(userTable);
  });

  it("should create a connection to a collection", async () => {
    // Create user
    const [user] = await db.insert(userTable).values({
      name: "Test User",
      email: "test@example.com",
    }).returning();

    // Create consumer
    await db.insert(consumerTable).values({
      userId: user.id,
      id: 1,
      name: "Test Consumer",
    });

    // Create collection (the new aggregation target)
    await db.insert(collectionTable).values({
      userId: user.id,
      id: 1,
      name: "Test Collection",
    });

    // Create connection to the collection
    const connection = await createConnection(user.id, {
      consumerId: 1,
      collectionId: 1,
    });

    expect(connection.userId).toBe(user.id);
    expect(connection.consumerId).toBe(1);
    expect(connection.collectionId).toBe(1);
  });

  it("should fail if collection does not exist (foreign key constraint)", async () => {
    // Create user
    const [user] = await db.insert(userTable).values({
      name: "Test User",
      email: "test@example.com",
    }).returning();

    // Create consumer
    await db.insert(consumerTable).values({
      userId: user.id,
      id: 1,
      name: "Test Consumer",
    });

    // Note: No collection created - this should fail with FK constraint
    await expect(
      createConnection(user.id, {
        consumerId: 1,
        collectionId: 999, // Non-existent collection
      })
    ).rejects.toThrow();
  });

  it("should work with collection that has mapped source collections", async () => {
    // Create user
    const [user] = await db.insert(userTable).values({
      name: "Test User",
      email: "test@example.com",
    }).returning();

    // Create source
    await db.insert(sourceTable).values({
      userId: user.id,
      id: 1,
      name: "Test Source",
      type: SourceType.STRAPI,
    });

    // Create source collection
    await db.insert(sourceCollectionTable).values({
      userId: user.id,
      sourceId: 1,
      id: 1,
      name: "Articles",
      ref: Buffer.from("api::article.article"),
    });

    // Create collection (aggregation target)
    await db.insert(collectionTable).values({
      userId: user.id,
      id: 1,
      name: "Articles Collection",
    });

    // Create influx from source collection to collection
    await db.insert(influxTable).values({
      id: 1,
      userId: user.id,
      collectionId: 1,
      sourceCollectionId: 1,
      schema: null,
      filters: null,
    });

    // Create consumer
    await db.insert(consumerTable).values({
      userId: user.id,
      id: 1,
      name: "Test Consumer",
    });

    // Create connection to the collection
    const connection = await createConnection(user.id, {
      consumerId: 1,
      collectionId: 1,
    });

    expect(connection.collectionId).toBe(1);
  });
});
