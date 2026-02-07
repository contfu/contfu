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
import { addSourceCollectionMapping } from "./addSourceCollectionMapping";
import { listSourceCollectionMappings } from "./listSourceCollectionMappings";
import { removeSourceCollectionMapping } from "./removeSourceCollectionMapping";
import { updateSourceCollectionMapping } from "./updateSourceCollectionMapping";

/**
 * Unit tests for Collection CRUD operations and mappings.
 * Uses real in-memory SQLite database, not mocks.
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

      expect(collection).toBeDefined();
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
      await createCollection(testUserId, { name: "Private Collection" });

      // Create another user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      // Try to access first user's collection with second user's ID
      const collection = await getCollection(user2.id, 1);

      expect(collection).toBeNull();
    });

    it("should include correct influx count", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection for mapping
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 1,
        sourceId: 1,
        name: "Blog Posts",
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 2,
        sourceId: 1,
        name: "News Articles",
      });

      // Add influxes
      await db.insert(influxTable).values([
        { userId: testUserId, id: 1, collectionId: 1, sourceCollectionId: 1 },
        { userId: testUserId, id: 2, collectionId: 1, sourceCollectionId: 2 },
      ]);

      const collection = await getCollection(testUserId, 1);

      expect(collection!.influxCount).toBe(2);
    });

    it("should include correct connection count", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create consumers
      await db.insert(consumerTable).values([
        { userId: testUserId, id: 1, name: "App 1" },
        { userId: testUserId, id: 2, name: "App 2" },
        { userId: testUserId, id: 3, name: "App 3" },
      ]);

      // Create connections
      await db.insert(connectionTable).values([
        { userId: testUserId, consumerId: 1, collectionId: 1 },
        { userId: testUserId, consumerId: 2, collectionId: 1 },
        { userId: testUserId, consumerId: 3, collectionId: 1 },
      ]);

      const collection = await getCollection(testUserId, 1);

      expect(collection!.connectionCount).toBe(3);
    });
  });

  describe("listCollections", () => {
    it("should return empty array when no collections exist", async () => {
      const collections = await listCollections(testUserId);

      expect(collections).toEqual([]);
    });

    it("should return all collections for a user with counts", async () => {
      await createCollection(testUserId, { name: "Articles" });
      await createCollection(testUserId, { name: "Products" });

      const collections = await listCollections(testUserId);

      expect(collections.length).toBe(2);
      expect(collections[0].name).toBe("Articles");
      expect(collections[0].influxCount).toBe(0);
      expect(collections[0].connectionCount).toBe(0);
      expect(collections[1].name).toBe("Products");
    });

    it("should include influx and connection counts", async () => {
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 1,
        sourceId: 1,
        name: "Blog Posts",
      });

      // Create influx
      await db.insert(influxTable).values({
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
      });

      // Create consumer and connection
      await db.insert(consumerTable).values({
        userId: testUserId,
        id: 1,
        name: "My App",
      });
      await db.insert(connectionTable).values({
        userId: testUserId,
        consumerId: 1,
        collectionId: 1,
      });

      const collections = await listCollections(testUserId);

      expect(collections.length).toBe(1);
      expect(collections[0].influxCount).toBe(1);
      expect(collections[0].connectionCount).toBe(1);
    });

    it("should only return collections for the specified user", async () => {
      await createCollection(testUserId, { name: "User1 Collection" });

      // Create another user with their own collection
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();
      await createCollection(user2.id, { name: "User2 Collection" });

      const collections = await listCollections(testUserId);

      expect(collections.length).toBe(1);
      expect(collections[0].name).toBe("User1 Collection");
    });

    it("should order collections by creation date", async () => {
      await createCollection(testUserId, { name: "First" });
      await createCollection(testUserId, { name: "Second" });
      await createCollection(testUserId, { name: "Third" });

      const collections = await listCollections(testUserId);

      expect(collections.map((c) => c.name)).toEqual(["First", "Second", "Third"]);
    });
  });

  describe("updateCollection", () => {
    it("should update collection name", async () => {
      await createCollection(testUserId, { name: "Old Name" });

      const updated = await updateCollection(testUserId, 1, { name: "New Name" });

      expect(updated).toBe(true);

      const collection = await getCollection(testUserId, 1);
      expect(collection!.name).toBe("New Name");
      expect(collection!.updatedAt).toBeGreaterThan(0);
    });

    it("should return false for non-existent collection", async () => {
      const updated = await updateCollection(testUserId, 999, { name: "New Name" });

      expect(updated).toBe(false);
    });

    it("should not update another user's collection", async () => {
      await createCollection(testUserId, { name: "Original" });

      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const updated = await updateCollection(user2.id, 1, { name: "Hacked" });

      expect(updated).toBe(false);

      // Verify original is unchanged
      const collection = await getCollection(testUserId, 1);
      expect(collection!.name).toBe("Original");
    });
  });

  describe("deleteCollection", () => {
    it("should delete a collection", async () => {
      await createCollection(testUserId, { name: "To Delete" });

      const deleted = await deleteCollection(testUserId, 1);

      expect(deleted).toBe(true);

      const collection = await getCollection(testUserId, 1);
      expect(collection).toBeNull();
    });

    it("should return false for non-existent collection", async () => {
      const deleted = await deleteCollection(testUserId, 999);

      expect(deleted).toBe(false);
    });

    it("should not delete another user's collection", async () => {
      await createCollection(testUserId, { name: "Protected" });

      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const deleted = await deleteCollection(user2.id, 1);

      expect(deleted).toBe(false);

      // Verify original exists
      const collection = await getCollection(testUserId, 1);
      expect(collection).toBeDefined();
    });

    it("should cascade delete influxes", async () => {
      await createCollection(testUserId, { name: "With Influxes" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 1,
        sourceId: 1,
        name: "Blog Posts",
      });

      // Create influx
      await db.insert(influxTable).values({
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
      });

      // Delete collection
      await deleteCollection(testUserId, 1);

      // Verify influx was cascade deleted
      const influxes = await db
        .select()
        .from(influxTable)
        .where((t) => t.collectionId === 1);

      expect(influxes.length).toBe(0);
    });

    it("should cascade delete connections", async () => {
      await createCollection(testUserId, { name: "With Connections" });

      // Create consumer
      await db.insert(consumerTable).values({
        userId: testUserId,
        id: 1,
        name: "My App",
      });

      // Create connection
      await db.insert(connectionTable).values({
        userId: testUserId,
        consumerId: 1,
        collectionId: 1,
      });

      // Delete collection
      await deleteCollection(testUserId, 1);

      // Verify connection was cascade deleted
      const connections = await db
        .select()
        .from(connectionTable)
        .where((t) => t.collectionId === 1);

      expect(connections.length).toBe(0);
    });
  });

  describe("addSourceCollectionMapping", () => {
    let sourceCollectionId: number;

    beforeEach(async () => {
      // Create collection for mappings
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      const [sc] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: testUserId,
          id: 1,
          sourceId: 1,
          name: "Blog Posts",
        })
        .returning();
      sourceCollectionId = sc.id;
    });

    it("should add a mapping without filters", async () => {
      const mapping = await addSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId,
      });

      expect(mapping.id).toBe(1);
      expect(mapping.userId).toBe(testUserId);
      expect(mapping.collectionId).toBe(1);
      expect(mapping.sourceCollectionId).toBe(sourceCollectionId);
      expect(mapping.filters).toBeNull();
      expect(mapping.createdAt).toBeGreaterThan(0);
    });

    it("should add a mapping with filters", async () => {
      const filters = [{ property: "status", operator: "equals", value: "published" }];

      const mapping = await addSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId,
        filters,
      });

      expect(mapping.filters).toEqual(filters);
    });

    it("should auto-increment mapping IDs per user", async () => {
      // Create additional source collections
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 2,
        sourceId: 1,
        name: "News",
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 3,
        sourceId: 1,
        name: "Events",
      });

      const mapping1 = await addSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 1,
      });
      const mapping2 = await addSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 2,
      });
      const mapping3 = await addSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 3,
      });

      expect(mapping1.id).toBe(1);
      expect(mapping2.id).toBe(2);
      expect(mapping3.id).toBe(3);
    });
  });

  describe("listSourceCollectionMappings", () => {
    beforeEach(async () => {
      // Create collection
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collections
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        name: "My CMS",
        type: 1,
      });
      await db.insert(sourceCollectionTable).values([
        { userId: testUserId, id: 1, sourceId: 1, name: "blog_posts", displayName: "Blog Posts" },
        { userId: testUserId, id: 2, sourceId: 1, name: "news_articles" },
      ]);
    });

    it("should return empty array when no mappings exist", async () => {
      const mappings = await listSourceCollectionMappings(testUserId, 1);

      expect(mappings).toEqual([]);
    });

    it("should return all mappings for a collection", async () => {
      // Add mappings
      await db.insert(influxTable).values([
        { userId: testUserId, id: 1, collectionId: 1, sourceCollectionId: 1 },
        { userId: testUserId, id: 2, collectionId: 1, sourceCollectionId: 2 },
      ]);

      const mappings = await listSourceCollectionMappings(testUserId, 1);

      expect(mappings.length).toBe(2);
      expect(mappings[0].sourceCollectionId).toBe(1);
      expect(mappings[0].sourceCollectionName).toBe("Blog Posts"); // Uses displayName
      expect(mappings[0].sourceId).toBe(1);
      expect(mappings[0].sourceName).toBe("My CMS");
      expect(mappings[1].sourceCollectionId).toBe(2);
      expect(mappings[1].sourceCollectionName).toBe("news_articles"); // Falls back to name
    });

    it("should only return mappings for the specified collection", async () => {
      // Create second collection
      await createCollection(testUserId, { name: "Products" });

      // Add mappings to different collections
      await db.insert(influxTable).values([
        { userId: testUserId, id: 1, collectionId: 1, sourceCollectionId: 1 },
        { userId: testUserId, id: 2, collectionId: 2, sourceCollectionId: 2 },
      ]);

      const mappings = await listSourceCollectionMappings(testUserId, 1);

      expect(mappings.length).toBe(1);
      expect(mappings[0].sourceCollectionId).toBe(1);
    });
  });

  describe("removeSourceCollectionMapping", () => {
    beforeEach(async () => {
      // Create collection
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 1,
        sourceId: 1,
        name: "Blog Posts",
      });

      // Create mapping
      await db.insert(influxTable).values({
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
      });
    });

    it("should remove a mapping", async () => {
      const removed = await removeSourceCollectionMapping(testUserId, 1, 1);

      expect(removed).toBe(true);

      const mappings = await listSourceCollectionMappings(testUserId, 1);
      expect(mappings.length).toBe(0);
    });

    it("should return false for non-existent mapping", async () => {
      const removed = await removeSourceCollectionMapping(testUserId, 1, 999);

      expect(removed).toBe(false);
    });

    it("should not remove another user's mapping", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const removed = await removeSourceCollectionMapping(user2.id, 1, 1);

      expect(removed).toBe(false);

      // Verify original exists
      const mappings = await listSourceCollectionMappings(testUserId, 1);
      expect(mappings.length).toBe(1);
    });
  });

  describe("updateSourceCollectionMapping", () => {
    beforeEach(async () => {
      // Create collection
      await createCollection(testUserId, { name: "Articles" });

      // Create source and source collection
      await db.insert(sourceTable).values({
        userId: testUserId,
        id: 1,
        type: 1,
      });
      await db.insert(sourceCollectionTable).values({
        userId: testUserId,
        id: 1,
        sourceId: 1,
        name: "Blog Posts",
      });

      // Create mapping without filters
      await db.insert(influxTable).values({
        userId: testUserId,
        id: 1,
        collectionId: 1,
        sourceCollectionId: 1,
      });
    });

    it("should update filters on a mapping", async () => {
      const filters = [{ property: "category", operator: "equals", value: "tech" }];

      const updated = await updateSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 1,
        filters,
      });

      expect(updated).toBe(true);

      const mappings = await listSourceCollectionMappings(testUserId, 1);
      expect(mappings[0].filters).toEqual(filters);
    });

    it("should clear filters when set to null", async () => {
      // First add filters
      const filters = [{ property: "category", operator: "equals", value: "tech" }];
      await updateSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 1,
        filters,
      });

      // Then clear them
      const updated = await updateSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 1,
        filters: null,
      });

      expect(updated).toBe(true);

      const mappings = await listSourceCollectionMappings(testUserId, 1);
      expect(mappings[0].filters).toBeNull();
    });

    it("should return false for non-existent mapping", async () => {
      const updated = await updateSourceCollectionMapping(testUserId, {
        collectionId: 1,
        sourceCollectionId: 999,
        filters: [],
      });

      expect(updated).toBe(false);
    });

    it("should not update another user's mapping", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const updated = await updateSourceCollectionMapping(user2.id, {
        collectionId: 1,
        sourceCollectionId: 1,
        filters: [{ property: "hacked", operator: "equals", value: true }],
      });

      expect(updated).toBe(false);
    });
  });
});
