import { beforeEach, describe, expect, it } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { collectionTable, connectionTable, consumerTable, userTable } from "../../infra/db/schema";
import { createConsumer } from "./createConsumer";
import { deleteConsumer } from "./deleteConsumer";
import { findConsumerByKey } from "./findConsumerByKey";
import { getConsumer } from "./getConsumer";
import { getConsumerWithConnectionCount } from "./getConsumerWithConnectionCount";
import { getConsumerWithKey } from "./getConsumerWithKey";
import { listConsumers } from "./listConsumers";
import { updateConsumer } from "./updateConsumer";

/**
 * Unit tests for consumer CRUD operations.
 * Uses real in-memory SQLite database, not mocks.
 */

// Check if db is mocked (mocked db won't have delete as a function)
const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Consumer Features", () => {
  let testUserId: number;

  beforeEach(async () => {
    await truncateAllTables();

    // Create a test user for all tests
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "consumer-test@test.com",
      })
      .returning();
    testUserId = user.id;
  });

  describe("createConsumer", () => {
    it("should create a consumer without a key", async () => {
      const consumer = await createConsumer(testUserId, { name: "My App" });

      expect(consumer.id).toBe(1);
      expect(consumer.userId).toBe(testUserId);
      expect(consumer.name).toBe("My App");
      expect(consumer.hasKey).toBe(false);
      expect(consumer.createdAt).toBeGreaterThan(0);
    });

    it("should create a consumer with a key", async () => {
      const key = Buffer.from("test-api-key-12345");
      const consumer = await createConsumer(testUserId, { name: "External App", key });

      expect(consumer.id).toBe(1);
      expect(consumer.name).toBe("External App");
      expect(consumer.hasKey).toBe(true);
    });

    it("should auto-increment consumer IDs per user", async () => {
      const consumer1 = await createConsumer(testUserId, { name: "App 1" });
      const consumer2 = await createConsumer(testUserId, { name: "App 2" });
      const consumer3 = await createConsumer(testUserId, { name: "App 3" });

      expect(consumer1.id).toBe(1);
      expect(consumer2.id).toBe(2);
      expect(consumer3.id).toBe(3);
    });

    it("should maintain separate ID sequences per user", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const consumer1ForUser1 = await createConsumer(testUserId, { name: "User1 App1" });
      const consumer1ForUser2 = await createConsumer(user2.id, { name: "User2 App1" });
      const consumer2ForUser1 = await createConsumer(testUserId, { name: "User1 App2" });

      // Each user has their own ID sequence starting at 1
      expect(consumer1ForUser1.id).toBe(1);
      expect(consumer1ForUser2.id).toBe(1);
      expect(consumer2ForUser1.id).toBe(2);
    });
  });

  describe("getConsumer", () => {
    it("should return a consumer by ID", async () => {
      await createConsumer(testUserId, { name: "My App" });

      const consumer = await getConsumer(testUserId, 1);

      expect(consumer).toBeDefined();
      expect(consumer!.id).toBe(1);
      expect(consumer!.name).toBe("My App");
    });

    it("should return undefined for non-existent consumer", async () => {
      const consumer = await getConsumer(testUserId, 999);

      expect(consumer).toBeUndefined();
    });

    it("should not return another user's consumer", async () => {
      await createConsumer(testUserId, { name: "My App" });

      // Create another user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Try to access first user's consumer with second user's ID
      const consumer = await getConsumer(user2.id, 1);

      expect(consumer).toBeUndefined();
    });
  });

  describe("listConsumers", () => {
    it("should return empty array when no consumers exist", async () => {
      const consumers = await listConsumers(testUserId);

      expect(consumers).toEqual([]);
    });

    it("should return all consumers for a user with connection counts", async () => {
      await createConsumer(testUserId, { name: "App 1" });
      await createConsumer(testUserId, { name: "App 2" });

      const consumers = await listConsumers(testUserId);

      expect(consumers.length).toBe(2);
      expect(consumers[0].name).toBe("App 1");
      expect(consumers[0].connectionCount).toBe(0);
      expect(consumers[1].name).toBe("App 2");
      expect(consumers[1].connectionCount).toBe(0);
    });

    it("should include connection counts", async () => {
      await createConsumer(testUserId, { name: "Connected App" });

      // Create a collection for connections
      const [collection] = await db
        .insert(collectionTable)
        .values({
          userId: testUserId,
          id: 1,
          name: "Articles",
        })
        .returning();

      // Create connections
      await db.insert(connectionTable).values([
        {
          userId: testUserId,
          consumerId: 1,
          collectionId: collection.id,
        },
      ]);

      const consumers = await listConsumers(testUserId);

      expect(consumers.length).toBe(1);
      expect(consumers[0].connectionCount).toBe(1);
    });

    it("should only return consumers for the specified user", async () => {
      await createConsumer(testUserId, { name: "User1 App" });

      // Create another user with their own consumer
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();
      await createConsumer(user2.id, { name: "User2 App" });

      const consumers = await listConsumers(testUserId);

      expect(consumers.length).toBe(1);
      expect(consumers[0].name).toBe("User1 App");
    });
  });

  describe("updateConsumer", () => {
    it("should update consumer name", async () => {
      await createConsumer(testUserId, { name: "Old Name" });

      const updated = await updateConsumer(testUserId, 1, { name: "New Name" });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
    });

    it("should update consumer key", async () => {
      await createConsumer(testUserId, { name: "App" });

      const key = Buffer.from("new-api-key");
      const updated = await updateConsumer(testUserId, 1, { key });

      expect(updated).toBeDefined();
      expect(updated!.hasKey).toBe(true);
    });

    it("should remove key by setting to null", async () => {
      const key = Buffer.from("initial-key");
      await createConsumer(testUserId, { name: "App", key });

      const updated = await updateConsumer(testUserId, 1, { key: null });

      expect(updated).toBeDefined();
      expect(updated!.hasKey).toBe(false);
    });

    it("should return undefined for non-existent consumer", async () => {
      const result = await updateConsumer(testUserId, 999, { name: "New Name" });

      expect(result).toBeUndefined();
    });

    it("should not update another user's consumer", async () => {
      await createConsumer(testUserId, { name: "Original" });

      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const result = await updateConsumer(user2.id, 1, { name: "Hacked" });

      expect(result).toBeUndefined();

      // Verify original is unchanged
      const original = await getConsumer(testUserId, 1);
      expect(original!.name).toBe("Original");
    });
  });

  describe("deleteConsumer", () => {
    it("should delete a consumer", async () => {
      await createConsumer(testUserId, { name: "To Delete" });

      const deleted = await deleteConsumer(testUserId, 1);

      expect(deleted).toBe(true);

      const check = await getConsumer(testUserId, 1);
      expect(check).toBeUndefined();
    });

    it("should return false for non-existent consumer", async () => {
      const deleted = await deleteConsumer(testUserId, 999);

      expect(deleted).toBe(false);
    });

    it("should not delete another user's consumer", async () => {
      await createConsumer(testUserId, { name: "Protected" });

      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const deleted = await deleteConsumer(user2.id, 1);

      expect(deleted).toBe(false);

      // Verify original exists
      const original = await getConsumer(testUserId, 1);
      expect(original).toBeDefined();
    });
  });

  describe("getConsumerWithKey", () => {
    it("should return consumer with key buffer", async () => {
      const key = Buffer.from("secret-api-key");
      await createConsumer(testUserId, { name: "Keyed App", key });

      const consumer = await getConsumerWithKey(testUserId, 1);

      expect(consumer).toBeDefined();
      expect(consumer!.key).toEqual(key);
    });

    it("should return consumer with null key", async () => {
      await createConsumer(testUserId, { name: "No Key App" });

      const consumer = await getConsumerWithKey(testUserId, 1);

      expect(consumer).toBeDefined();
      expect(consumer!.key).toBeNull();
    });

    it("should return undefined for non-existent consumer", async () => {
      const consumer = await getConsumerWithKey(testUserId, 999);

      expect(consumer).toBeUndefined();
    });
  });

  describe("findConsumerByKey", () => {
    it("should find consumer by exact key match", async () => {
      const key = Buffer.from("unique-api-key-12345");
      await createConsumer(testUserId, { name: "Findable App", key });

      const consumer = await findConsumerByKey(key);

      expect(consumer).toBeDefined();
      expect(consumer!.name).toBe("Findable App");
      expect(consumer!.key).toEqual(key);
    });

    it("should return undefined for non-existent key", async () => {
      const consumer = await findConsumerByKey(Buffer.from("non-existent-key"));

      expect(consumer).toBeUndefined();
    });

    it("should find correct consumer among multiple", async () => {
      const key1 = Buffer.from("key-one");
      const key2 = Buffer.from("key-two");
      const key3 = Buffer.from("key-three");

      await createConsumer(testUserId, { name: "App 1", key: key1 });
      await createConsumer(testUserId, { name: "App 2", key: key2 });
      await createConsumer(testUserId, { name: "App 3", key: key3 });

      const consumer = await findConsumerByKey(key2);

      expect(consumer).toBeDefined();
      expect(consumer!.name).toBe("App 2");
    });
  });

  describe("getConsumerWithConnectionCount", () => {
    it("should return consumer with zero connections", async () => {
      await createConsumer(testUserId, { name: "Lonely App" });

      const consumer = await getConsumerWithConnectionCount(testUserId, 1);

      expect(consumer).toBeDefined();
      expect(consumer!.name).toBe("Lonely App");
      expect(consumer!.connectionCount).toBe(0);
    });

    it("should return consumer with correct connection count", async () => {
      await createConsumer(testUserId, { name: "Popular App" });

      // Create collections
      await db.insert(collectionTable).values([
        { userId: testUserId, id: 1, name: "Collection 1" },
        { userId: testUserId, id: 2, name: "Collection 2" },
        { userId: testUserId, id: 3, name: "Collection 3" },
      ]);

      // Create multiple connections
      await db.insert(connectionTable).values([
        { userId: testUserId, consumerId: 1, collectionId: 1 },
        { userId: testUserId, consumerId: 1, collectionId: 2 },
        { userId: testUserId, consumerId: 1, collectionId: 3 },
      ]);

      const consumer = await getConsumerWithConnectionCount(testUserId, 1);

      expect(consumer).toBeDefined();
      expect(consumer!.connectionCount).toBe(3);
    });

    it("should return undefined for non-existent consumer", async () => {
      const consumer = await getConsumerWithConnectionCount(testUserId, 999);

      expect(consumer).toBeUndefined();
    });
  });
});
