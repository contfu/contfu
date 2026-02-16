import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { pack } from "msgpackr";
import crypto from "node:crypto";
import { FilterOperator, PropertyType, type CollectionSchema, type Filter } from "@contfu/core";
import { createInflux } from "./createInflux";
import { getInflux } from "./getInflux";
import { listInfluxes } from "./listInfluxes";
import { listAllInfluxes } from "./listAllInfluxes";
import { updateInflux } from "./updateInflux";
import { deleteInflux } from "./deleteInflux";
import { deleteInfluxByMapping } from "./deleteInfluxByMapping";

/**
 * Unit tests for influx CRUD operations.
 * Uses real in-memory SQLite database, not mocks.
 */

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Influx Features", () => {
  let testUserId: number;
  let testSourceId: number;
  let testSourceCollectionId: number;
  let testCollectionId: number;

  const testSchema: CollectionSchema = {
    title: PropertyType.STRING,
    content: PropertyType.STRING,
  };

  beforeEach(async () => {
    // Delete in correct order for foreign keys
    await db.delete(influxTable);
    await db.delete(collectionTable);
    await db.delete(sourceCollectionTable);
    await db.delete(sourceTable);
    await db.delete(userTable);

    // Create test user
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "influx-test@test.com",
      })
      .returning();
    testUserId = user.id;

    // Create test source
    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: testUserId,
        uid: crypto.randomUUID(),
        type: 1,
        name: "Test Source",
      })
      .returning();
    testSourceId = source.id;

    // Create test source collection
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId: testUserId,
        sourceId: testSourceId,
        name: "Articles",
        schema: pack(testSchema),
      })
      .returning();
    testSourceCollectionId = sourceCollection.id;

    // Create test collection
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        name: "My Collection",
      })
      .returning();
    testCollectionId = collection.id;
  });

  describe("createInflux", () => {
    it("should create an influx linking source collection to collection", async () => {
      const influx = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      expect(influx.id).toBeGreaterThan(0);
      expect(influx.userId).toBe(testUserId);
      expect(influx.collectionId).toBe(testCollectionId);
      expect(influx.sourceCollectionId).toBe(testSourceCollectionId);
      expect(influx.createdAt).toBeInstanceOf(Date);
    });

    it("should auto-fetch schema from source collection if not provided", async () => {
      const influx = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      expect(influx.schema).toEqual(testSchema);
    });

    it("should use provided schema instead of fetching", async () => {
      const customSchema: CollectionSchema = {
        custom: PropertyType.NUMBER,
      };

      const influx = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
        schema: customSchema,
      });

      expect(influx.schema).toEqual(customSchema);
    });

    it("should store filters when provided", async () => {
      const filters: Filter[] = [
        { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
      ];

      const influx = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
        filters,
      });

      expect(influx.filters).toEqual(filters);
    });

    it("should auto-increment influx IDs per user", async () => {
      // Create second source collection for another influx
      const [sourceCollection2] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: testUserId,
          sourceId: testSourceId,
          name: "Posts",
        })
        .returning();

      const influx1 = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });
      const influx2 = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: sourceCollection2.id,
      });

      expect(influx2.id).toBeGreaterThan(influx1.id);
    });

    it("should allow creating influxes for different users", async () => {
      // Create second user with their own source/collection setup
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const [source2] = await db
        .insert(sourceTable)
        .values({
          userId: user2.id,
          uid: crypto.randomUUID(),
          type: 1,
          name: "User2 Source",
        })
        .returning();
      const [sourceCollection2] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: user2.id,
          sourceId: source2.id,
          name: "User2 Articles",
        })
        .returning();
      const [collection2] = await db
        .insert(collectionTable)
        .values({
          userId: user2.id,
          name: "User2 Collection",
        })
        .returning();

      const influx1 = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });
      const influx2 = await createInflux(user2.id, {
        collectionId: collection2.id,
        sourceCollectionId: sourceCollection2.id,
      });

      expect(influx1.userId).toBe(testUserId);
      expect(influx2.userId).toBe(user2.id);
    });

    it("should reject creating an influx for another user's collection", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2-x@test.com" })
        .returning();

      const [otherCollection] = await db
        .insert(collectionTable)
        .values({
          userId: user2.id,
          name: "Other User Collection",
        })
        .returning();

      await expect(
        createInflux(testUserId, {
          collectionId: otherCollection.id,
          sourceCollectionId: testSourceCollectionId,
        }),
      ).rejects.toThrow("Collection not found");
    });

    it("should reject creating an influx for another user's source collection", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2-y@test.com" })
        .returning();

      const [otherSource] = await db
        .insert(sourceTable)
        .values({
          userId: user2.id,
          uid: crypto.randomUUID(),
          type: 1,
          name: "Other Source",
        })
        .returning();
      const [otherSourceCollection] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: user2.id,
          sourceId: otherSource.id,
          name: "Other Source Collection",
        })
        .returning();

      await expect(
        createInflux(testUserId, {
          collectionId: testCollectionId,
          sourceCollectionId: otherSourceCollection.id,
        }),
      ).rejects.toThrow("Source collection not found");
    });
  });

  describe("getInflux", () => {
    it("should return influx with source details", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const influx = await getInflux(testUserId, created.id);

      expect(influx).toBeDefined();
      expect(influx!.id).toBe(created.id);
      expect(influx!.sourceCollectionName).toBe("Articles");
      expect(influx!.sourceName).toBe("Test Source");
      expect(influx!.sourceId).toBe(testSourceId);
    });

    it("should return null for non-existent influx", async () => {
      const influx = await getInflux(testUserId, 999);

      expect(influx).toBeNull();
    });

    it("should not return another user's influx", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const influx = await getInflux(user2.id, created.id);

      expect(influx).toBeNull();
    });
  });

  describe("listInfluxes", () => {
    it("should return empty array when no influxes exist", async () => {
      const influxes = await listInfluxes(testUserId, testCollectionId);

      expect(influxes).toEqual([]);
    });

    it("should return all influxes for a collection", async () => {
      // Create second source collection
      const [sourceCollection2] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: testUserId,
          sourceId: testSourceId,
          name: "Posts",
        })
        .returning();

      await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });
      await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: sourceCollection2.id,
      });

      const influxes = await listInfluxes(testUserId, testCollectionId);

      expect(influxes.length).toBe(2);
      expect(influxes[0].sourceCollectionName).toBe("Articles");
      expect(influxes[1].sourceCollectionName).toBe("Posts");
    });

    it("should only return influxes for the specified collection", async () => {
      // Create second collection
      const [collection2] = await db
        .insert(collectionTable)
        .values({
          userId: testUserId,
          name: "Other Collection",
        })
        .returning();

      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });
      await createInflux(testUserId, {
        collectionId: collection2.id,
        sourceCollectionId: testSourceCollectionId,
      });

      const influxes = await listInfluxes(testUserId, testCollectionId);

      expect(influxes.length).toBe(1);
      expect(influxes[0].id).toBe(created.id);
    });
  });

  describe("listAllInfluxes", () => {
    it("should return all influxes across all collections", async () => {
      // Create second collection
      const [collection2] = await db
        .insert(collectionTable)
        .values({
          userId: testUserId,
          name: "Other Collection",
        })
        .returning();

      await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });
      await createInflux(testUserId, {
        collectionId: collection2.id,
        sourceCollectionId: testSourceCollectionId,
      });

      const influxes = await listAllInfluxes(testUserId);

      expect(influxes.length).toBe(2);
    });
  });

  describe("updateInflux", () => {
    it("should update influx filters", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const filters: Filter[] = [
        { property: "title", operator: FilterOperator.EQ, value: "updated" },
      ];
      const updated = await updateInflux(testUserId, { id: created.id, filters });

      expect(updated).toBeDefined();
      expect(updated!.filters).toEqual(filters);
      expect(updated!.updatedAt).toBeInstanceOf(Date);
    });

    it("should update influx schema", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const newSchema: CollectionSchema = {
        newField: PropertyType.BOOLEAN,
      };
      const updated = await updateInflux(testUserId, { id: created.id, schema: newSchema });

      expect(updated).toBeDefined();
      expect(updated!.schema).toEqual(newSchema);
    });

    it("should update includeRef setting", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const updated = await updateInflux(testUserId, { id: created.id, includeRef: true });

      expect(updated).toBeDefined();
      expect(updated!.includeRef).toBe(true);
    });

    it("should clear filters when set to null", async () => {
      const filters: Filter[] = [
        { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
      ];
      await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
        filters,
      });

      const existing = await listInfluxes(testUserId, testCollectionId);
      const updated = await updateInflux(testUserId, { id: existing[0].id, filters: null });

      expect(updated).toBeDefined();
      expect(updated!.filters).toBeNull();
    });

    it("should return null for non-existent influx", async () => {
      const result = await updateInflux(testUserId, { id: 999, includeRef: true });

      expect(result).toBeNull();
    });

    it("should not update another user's influx", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const result = await updateInflux(user2.id, { id: created.id, includeRef: true });

      expect(result).toBeNull();
    });
  });

  describe("deleteInflux", () => {
    it("should delete an influx by ID", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const deleted = await deleteInflux(testUserId, created.id);

      expect(deleted).toBe(true);

      const check = await getInflux(testUserId, created.id);
      expect(check).toBeNull();
    });

    it("should return false for non-existent influx", async () => {
      const deleted = await deleteInflux(testUserId, 999);

      expect(deleted).toBe(false);
    });

    it("should not delete another user's influx", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const deleted = await deleteInflux(user2.id, created.id);

      expect(deleted).toBe(false);

      // Verify original exists
      const original = await getInflux(testUserId, created.id);
      expect(original).toBeDefined();
    });
  });

  describe("deleteInfluxByMapping", () => {
    it("should delete an influx by collection and source collection IDs", async () => {
      const created = await createInflux(testUserId, {
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      const deleted = await deleteInfluxByMapping(
        testUserId,
        testCollectionId,
        testSourceCollectionId,
      );

      expect(deleted).toBe(true);

      const check = await getInflux(testUserId, created.id);
      expect(check).toBeNull();
    });

    it("should return false when mapping doesn't exist", async () => {
      const deleted = await deleteInfluxByMapping(testUserId, 999, 999);

      expect(deleted).toBe(false);
    });
  });
});
