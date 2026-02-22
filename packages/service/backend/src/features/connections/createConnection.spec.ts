import { SourceType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { runTest } from "../../../test/effect-helpers";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { createConnection } from "./createConnection";

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
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "test@example.com",
      })
      .returning();

    // Create consumer
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: user.id,
        name: "Test Consumer",
      })
      .returning();

    // Create collection (the new aggregation target)
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: user.id,
        name: "Test Collection",
      })
      .returning();

    // Create connection to the collection
    const connection = await runTest(
      createConnection(user.id, {
        consumerId: consumer.id,
        collectionId: collection.id,
      }),
    );

    expect(connection.userId).toBe(user.id);
    expect(connection.consumerId).toBe(consumer.id);
    expect(connection.collectionId).toBe(collection.id);
  });

  it("should fail if collection does not exist (foreign key constraint)", async () => {
    // Create user
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "test@example.com",
      })
      .returning();

    // Create consumer
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: user.id,
        name: "Test Consumer",
      })
      .returning();

    // Note: No collection created - this should fail with FK constraint
    await expect(
      runTest(
        createConnection(user.id, {
          consumerId: consumer.id,
          collectionId: 999, // Non-existent collection
        }),
      ),
    ).rejects.toThrow();
  });

  it("should work with collection that has mapped source collections", async () => {
    // Create user
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "test@example.com",
      })
      .returning();

    // Create source
    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: user.id,
        uid: crypto.randomUUID(),
        name: "Test Source",
        type: SourceType.STRAPI,
      })
      .returning();

    // Create source collection
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId: user.id,
        sourceId: source.id,
        name: "Articles",
        ref: Buffer.from("api::article.article"),
      })
      .returning();

    // Create collection (aggregation target)
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: user.id,
        name: "Articles Collection",
      })
      .returning();

    // Create influx from source collection to collection
    await db.insert(influxTable).values({
      userId: user.id,
      collectionId: collection.id,
      sourceCollectionId: sourceCollection.id,
      schema: null,
      filters: null,
    });

    // Create consumer
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: user.id,
        name: "Test Consumer",
      })
      .returning();

    // Create connection to the collection
    const connection = await runTest(
      createConnection(user.id, {
        consumerId: consumer.id,
        collectionId: collection.id,
      }),
    );

    expect(connection.collectionId).toBe(collection.id);
  });

  it("should reject connecting to another user's consumer", async () => {
    const [user1] = await db
      .insert(userTable)
      .values({
        name: "User 1",
        email: "user1@example.com",
      })
      .returning();
    const [user2] = await db
      .insert(userTable)
      .values({
        name: "User 2",
        email: "user2@example.com",
      })
      .returning();

    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: user1.id,
        name: "User1 Collection",
      })
      .returning();
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: user2.id,
        name: "User2 Consumer",
      })
      .returning();

    await expect(
      runTest(
        createConnection(user1.id, {
          consumerId: consumer.id,
          collectionId: collection.id,
        }),
      ),
    ).rejects.toThrow("Consumer not found");
  });

  it("should reject connecting to another user's collection", async () => {
    const [user1] = await db
      .insert(userTable)
      .values({
        name: "User 1",
        email: "user1-2@example.com",
      })
      .returning();
    const [user2] = await db
      .insert(userTable)
      .values({
        name: "User 2",
        email: "user2-2@example.com",
      })
      .returning();

    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId: user1.id,
        name: "User1 Consumer",
      })
      .returning();
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: user2.id,
        name: "User2 Collection",
      })
      .returning();

    await expect(
      runTest(
        createConnection(user1.id, {
          consumerId: consumer.id,
          collectionId: collection.id,
        }),
      ),
    ).rejects.toThrow("Collection not found");
  });
});
