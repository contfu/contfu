import { beforeEach, describe, expect, it } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { createCollection } from "./createCollection";
import { deleteCollection } from "./deleteCollection";
import { getCollection } from "./getCollection";
import { listCollections } from "./listCollections";
import { updateCollection } from "./updateCollection";

/**
 * Unit tests for Collection CRUD operations.
 * Uses real in-memory SQLite database, not mocks.
 *
 * Note: Influx/mapping tests are in influxes.spec.ts
 */

// Check if db is mocked (mocked db won't have delete as a function)
const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Collection Features", () => {
  let testUserId: number;

  beforeEach(async () => {
    await truncateAllTables();

    // Create a test user for all tests
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "collection-test@test.com",
      })
      .returning();
    testUserId = user.id;
  });

  describe("createCollection", () => {
    it("should create a collection with given name", async () => {
      const collection = await createCollection(testUserId, { name: "Articles" });

      expect(collection.id).toBe(1);
      expect(collection.userId).toBe(testUserId);
      expect(collection.name).toBe("Articles");
      expect(collection.influxCount).toBe(0);
      expect(collection.connectionCount).toBe(0);
      expect(collection.createdAt).toBeGreaterThan(0);
    });

    it("should auto-increment collection IDs per user", async () => {
      const collection1 = await createCollection(testUserId, { name: "Articles" });
      const collection2 = await createCollection(testUserId, { name: "Products" });
      const collection3 = await createCollection(testUserId, { name: "Events" });

      expect(collection1.id).toBe(1);
      expect(collection2.id).toBe(2);
      expect(collection3.id).toBe(3);
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

      const collection1ForUser1 = await createCollection(testUserId, { name: "User1 Collection1" });
      const collection1ForUser2 = await createCollection(user2.id, { name: "User2 Collection1" });
      const collection2ForUser1 = await createCollection(testUserId, { name: "User1 Collection2" });

      // Each user has their own ID sequence starting at 1
      expect(collection1ForUser1.id).toBe(1);
      expect(collection1ForUser2.id).toBe(1);
      expect(collection2ForUser1.id).toBe(2);
    });
  });

  describe("getCollection", () => {
    it("should return a collection by ID with counts", async () => {
      await createCollection(testUserId, { name: "Articles" });

      const collection = await getCollection(testUserId, 1);

      expect(collection).not.toBeNull();
      expect(collection!.id).toBe(1);
      expect(collection!.name).toBe("Articles");
      expect(collection!.influxCount).toBe(0);
      expect(collection!.connectionCount).toBe(0);
    });

    it("should return null for non-existent collection", async () => {
      const collection = await getCollection(testUserId, 999);
      expect(collection).toBeNull();
    });

    it("should not return another user's collection", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Create collection for user1
      await createCollection(testUserId, { name: "User1 Articles" });

      // User2 should not see user1's collection
      const collection = await getCollection(user2.id, 1);
      expect(collection).toBeNull();
    });

    it("should count influxes correctly", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        id: 1,
        userId: testUserId,
        type: 1,
        name: "Strapi",
        createdAt: Date.now(),
      });

      await db.insert(sourceCollectionTable).values({
        id: 1,
        userId: testUserId,
        sourceId: 1,
        name: "articles",
        displayName: "Articles",
        ref: Buffer.from("articles"),
      });

      // Add influxes
      await db.insert(influxTable).values([
        { id: 1, userId: testUserId, collectionId: 1, sourceCollectionId: 1 },
        { id: 2, userId: testUserId, collectionId: 1, sourceCollectionId: 1 },
      ]);

      const collection = await getCollection(testUserId, 1);
      expect(collection!.influxCount).toBe(2);
    });

    it("should count connections correctly", async () => {
      await createCollection(testUserId, { name: "Articles" });
      await createCollection(testUserId, { name: "Products" });

      // Create consumers
      await db.insert(consumerTable).values([
        {
          id: 1,
          userId: testUserId,
          key: Buffer.alloc(32),
          name: "Consumer 1",
          createdAt: Date.now(),
        },
        {
          id: 2,
          userId: testUserId,
          key: Buffer.alloc(32).fill(1),
          name: "Consumer 2",
          createdAt: Date.now(),
        },
      ]);

      // Add connections (different consumers to avoid PK conflict)
      await db.insert(connectionTable).values([
        { userId: testUserId, consumerId: 1, collectionId: 1 },
        { userId: testUserId, consumerId: 2, collectionId: 1 },
      ]);

      const collection = await getCollection(testUserId, 1);
      expect(collection!.connectionCount).toBe(2);
    });
  });

  describe("listCollections", () => {
    it("should return empty array when no collections", async () => {
      const collections = await listCollections(testUserId);
      expect(collections).toEqual([]);
    });

    it("should return all collections with counts", async () => {
      await createCollection(testUserId, { name: "Articles" });
      await createCollection(testUserId, { name: "Products" });
      await createCollection(testUserId, { name: "Events" });

      const collections = await listCollections(testUserId);

      expect(collections.length).toBe(3);
      expect(collections[0].name).toBe("Articles");
      expect(collections[1].name).toBe("Products");
      expect(collections[2].name).toBe("Events");

      // All should have zero counts initially
      for (const col of collections) {
        expect(col.influxCount).toBe(0);
        expect(col.connectionCount).toBe(0);
      }
    });

    it("should not return another user's collections", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Create collections for both users
      await createCollection(testUserId, { name: "User1 Articles" });
      await createCollection(testUserId, { name: "User1 Products" });
      await createCollection(user2.id, { name: "User2 Articles" });

      // User1 should only see their own collections
      const user1Collections = await listCollections(testUserId);
      expect(user1Collections.length).toBe(2);
      expect(user1Collections.every((c) => c.name.startsWith("User1"))).toBe(true);

      // User2 should only see their own collections
      const user2Collections = await listCollections(user2.id);
      expect(user2Collections.length).toBe(1);
      expect(user2Collections[0].name).toBe("User2 Articles");
    });

    it("should return collections ordered by creation date", async () => {
      // Create collections with slight delay to ensure different timestamps
      await createCollection(testUserId, { name: "First" });
      await createCollection(testUserId, { name: "Second" });
      await createCollection(testUserId, { name: "Third" });

      const collections = await listCollections(testUserId);

      expect(collections[0].name).toBe("First");
      expect(collections[1].name).toBe("Second");
      expect(collections[2].name).toBe("Third");
    });
  });

  describe("updateCollection", () => {
    it("should update collection name and return true", async () => {
      await createCollection(testUserId, { name: "Articles" });

      const updated = await updateCollection(testUserId, 1, { name: "Blog Posts" });

      expect(updated).toBe(true);

      // Verify the update persisted
      const collection = await getCollection(testUserId, 1);
      expect(collection!.name).toBe("Blog Posts");
    });

    it("should return false for non-existent collection", async () => {
      const updated = await updateCollection(testUserId, 999, { name: "New Name" });
      expect(updated).toBe(false);
    });

    it("should not update another user's collection", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Create collection for user1
      await createCollection(testUserId, { name: "User1 Articles" });

      // User2 should not be able to update user1's collection
      const updated = await updateCollection(user2.id, 1, { name: "Hacked!" });
      expect(updated).toBe(false);

      // Original should be unchanged
      const collection = await getCollection(testUserId, 1);
      expect(collection!.name).toBe("User1 Articles");
    });
  });

  describe("deleteCollection", () => {
    it("should delete a collection", async () => {
      await createCollection(testUserId, { name: "Articles" });

      const deleted = await deleteCollection(testUserId, 1);
      expect(deleted).toBe(true);

      // Verify deletion
      const collection = await getCollection(testUserId, 1);
      expect(collection).toBeNull();
    });

    it("should return false for non-existent collection", async () => {
      const deleted = await deleteCollection(testUserId, 999);
      expect(deleted).toBe(false);
    });

    it("should not delete another user's collection", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Create collection for user1
      await createCollection(testUserId, { name: "User1 Articles" });

      // User2 should not be able to delete user1's collection
      const deleted = await deleteCollection(user2.id, 1);
      expect(deleted).toBe(false);

      // Original should still exist
      const collection = await getCollection(testUserId, 1);
      expect(collection).not.toBeNull();
    });

    it("should cascade delete influxes", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        id: 1,
        userId: testUserId,
        type: 1,
        name: "Strapi",
        createdAt: Date.now(),
      });

      await db.insert(sourceCollectionTable).values({
        id: 1,
        userId: testUserId,
        sourceId: 1,
        name: "articles",
        displayName: "Articles",
        ref: Buffer.from("articles"),
      });

      // Add influxes
      await db.insert(influxTable).values([
        { id: 1, userId: testUserId, collectionId: 1, sourceCollectionId: 1 },
        { id: 2, userId: testUserId, collectionId: 1, sourceCollectionId: 1 },
      ]);

      // Delete collection
      await deleteCollection(testUserId, 1);

      // Verify influxes were cascade deleted
      const influxes = await db.select().from(influxTable);
      expect(influxes.length).toBe(0);
    });

    it("should cascade delete connections", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create consumers
      await db.insert(consumerTable).values([
        {
          id: 1,
          userId: testUserId,
          key: Buffer.alloc(32),
          name: "Consumer 1",
          createdAt: Date.now(),
        },
        {
          id: 2,
          userId: testUserId,
          key: Buffer.alloc(32).fill(1),
          name: "Consumer 2",
          createdAt: Date.now(),
        },
      ]);

      // Add connections (different consumers)
      await db.insert(connectionTable).values([
        { userId: testUserId, consumerId: 1, collectionId: 1 },
        { userId: testUserId, consumerId: 2, collectionId: 1 },
      ]);

      // Delete collection
      await deleteCollection(testUserId, 1);

      // Verify connections were cascade deleted
      const connections = await db.select().from(connectionTable);
      expect(connections.length).toBe(0);
    });
  });
});
