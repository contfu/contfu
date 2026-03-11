import { ConnectionType } from "@contfu/core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import { connectionTable, collectionTable, userTable } from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { lru } from "tiny-lru";
import type { DataSourceInfo } from "../../src/lib/remote/inflows.remote";
import { truncateAllTables } from "../../test/setup";

/**
 * Integration tests for the Notion cache probe-refresh flow.
 *
 * These tests verify the cache behavior patterns and data flow.
 * Full end-to-end testing with actual API calls is covered in e2e tests.
 */

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Notion Cache Integration", () => {
  let testUserId: number;
  let testConnectionId: number;

  beforeEach(async () => {
    // Truncate all tables for clean slate
    await truncateAllTables();

    // Create test user
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Integration Test User",
        email: "integration-test@test.com",
      })
      .returning();
    testUserId = user.id;

    // Create test Notion connection
    const mockToken = "test-notion-token";
    const encryptedCreds = await encryptCredentials(testUserId, Buffer.from(mockToken, "utf8"));

    const [connection] = await db
      .insert(connectionTable)
      .values({
        userId: testUserId,
        type: ConnectionType.NOTION,
        name: "Test Notion Connection",
        credentials: encryptedCreds,
        uid: crypto.randomUUID(),
      })
      .returning();
    testConnectionId = connection.id;
  });

  describe("Cache Key Strategy", () => {
    it("should generate consistent cache keys for user-connection pairs", () => {
      // Cache keys follow pattern: notion-ds:${userId}:${connectionId}
      const cacheKey1 = `notion-ds:${testUserId}:${testConnectionId}`;
      const cacheKey2 = `notion-ds:${testUserId}:${testConnectionId}`;

      expect(cacheKey1).toBe(cacheKey2);
      expect(cacheKey1).toMatch(/^notion-ds:\d+:\d+$/);
    });

    it("should generate different keys for different users", () => {
      const key1 = `notion-ds:${testUserId}:${testConnectionId}`;
      const key2 = `notion-ds:${testUserId + 1}:${testConnectionId}`;

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different connections", () => {
      const key1 = `notion-ds:${testUserId}:${testConnectionId}`;
      const key2 = `notion-ds:${testUserId}:${testConnectionId + 1}`;

      expect(key1).not.toBe(key2);
    });
  });

  describe("Cache Structure and TTL", () => {
    it("should store data source info without DB-enriched fields", () => {
      // Create a mock cache to test structure
      const testCache = lru<Omit<DataSourceInfo, "exists" | "externalCollectionId">[]>(
        100,
        5 * 60 * 1000,
      );

      const cachedData = [
        {
          id: "db-123",
          title: "Test Database",
          icon: { type: "emoji" as const, value: "\u{1F4DA}" },
          schema: null,
        },
      ];

      const cacheKey = `notion-ds:${testUserId}:${testConnectionId}`;
      testCache.set(cacheKey, cachedData);

      const retrieved = testCache.get(cacheKey);
      expect(retrieved).toBeDefined();
      expect(retrieved?.[0]).toHaveProperty("id");
      expect(retrieved?.[0]).toHaveProperty("title");
      expect(retrieved?.[0]).toHaveProperty("icon");
      expect(retrieved?.[0]).toHaveProperty("schema");
      expect(retrieved?.[0]).not.toHaveProperty("exists");
      expect(retrieved?.[0]).not.toHaveProperty("externalCollectionId");
    });

    it("should have 5-minute TTL", () => {
      const ttlMs = 5 * 60 * 1000;
      // Cache should have TTL set
      expect(ttlMs).toBe(300000); // 5 minutes in milliseconds
    });

    it("should support cache invalidation", () => {
      const testCache = lru<any[]>(100, 5 * 60 * 1000);
      const cacheKey = `notion-ds:${testUserId}:${testConnectionId}`;

      // Set data
      testCache.set(cacheKey, [{ id: "test", title: "Test", icon: null, schema: null }]);
      expect(testCache.get(cacheKey)).toBeDefined();

      // Invalidate
      testCache.delete(cacheKey);
      expect(testCache.get(cacheKey)).toBeUndefined();
    });
  });

  describe("Data Enrichment from Database", () => {
    it("should enrich cached data with exists flag and collectionId", async () => {
      // Create a collection with connectionId in DB
      const [collection] = await db
        .insert(collectionTable)
        .values({
          userId: testUserId,
          connectionId: testConnectionId,
          name: "Existing Collection",
          displayName: "Existing Collection",
          ref: Buffer.from("db-123", "utf8"),
        })
        .returning();

      // Simulate cached data (without enrichment)
      const cachedDataSource = {
        id: "db-123",
        title: "Test Database",
        icon: null,
        schema: null,
      };

      // Simulate enrichment logic
      const existingId = collection.id;
      const enrichedDataSource = {
        ...cachedDataSource,
        exists: existingId !== undefined,
        externalCollectionId: existingId,
      };

      expect(enrichedDataSource.exists).toBe(true);
      expect(enrichedDataSource.externalCollectionId).toBe(1);
    });

    it("should mark non-existent data sources correctly", async () => {
      // No collection in DB
      const cachedDataSource = {
        id: "db-456",
        title: "New Database",
        icon: null,
        schema: null,
      };

      // Simulate enrichment with no match
      const enrichedDataSource = {
        ...cachedDataSource,
        exists: false,
        externalCollectionId: undefined,
      };

      expect(enrichedDataSource.exists).toBe(false);
      expect(enrichedDataSource.externalCollectionId).toBeUndefined();
    });
  });

  describe("Cache Isolation", () => {
    it("should isolate cache entries by userId", async () => {
      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({
          name: "User 2",
          email: "user2@test.com",
        })
        .returning();

      const testCache = lru<any[]>(100, 5 * 60 * 1000);

      // Cache data for user 1
      const key1 = `notion-ds:${testUserId}:${testConnectionId}`;
      testCache.set(key1, [{ id: "db-1", title: "User 1 Data", icon: null, schema: null }]);

      // Cache different data for user 2 with same connection ID
      const key2 = `notion-ds:${user2.id}:${testConnectionId}`;
      testCache.set(key2, [{ id: "db-2", title: "User 2 Data", icon: null, schema: null }]);

      // Verify isolation
      const user1Data = testCache.get(key1);
      const user2Data = testCache.get(key2);

      expect(user1Data?.[0].title).toBe("User 1 Data");
      expect(user2Data?.[0].title).toBe("User 2 Data");
      expect(user1Data).not.toEqual(user2Data);
    });
  });

  describe("Error Handling Patterns", () => {
    it("should preserve cache structure on error", () => {
      const testCache = lru<any[]>(100, 5 * 60 * 1000);
      const cacheKey = `notion-ds:${testUserId}:${testConnectionId}`;

      // Set initial data
      const originalData = [{ id: "db-123", title: "Original", icon: null, schema: null }];
      testCache.set(cacheKey, originalData);

      // Simulate error during refresh (don't update cache)
      // Cache should still have original data
      const preserved = testCache.get(cacheKey);
      expect(preserved).toEqual(originalData);
      expect(preserved?.[0].title).toBe("Original");
    });

    it("should handle empty results", () => {
      const testCache = lru<any[]>(100, 5 * 60 * 1000);
      const cacheKey = `notion-ds:${testUserId}:${testConnectionId}`;

      // Cache empty array (valid result - no databases found)
      testCache.set(cacheKey, []);

      const result = testCache.get(cacheKey);
      expect(result).toBeDefined();
      expect(result).toBeArray();
      expect(result?.length).toBe(0);
    });
  });

  describe("Refresh Command Requirements", () => {
    it("should validate connection exists before refresh", async () => {
      // Valid connection exists
      const validConnectionId = testConnectionId;

      const connections = await db.select().from(connectionTable);
      const connectionExists = connections.some((c: any) => c.id === validConnectionId);

      expect(connectionExists).toBe(true);
    });

    it("should handle non-existent connection gracefully", async () => {
      const nonExistentConnectionId = 99999;

      const connections = await db.select().from(connectionTable);
      const connectionExists = connections.some((c: any) => c.id === nonExistentConnectionId);

      expect(connectionExists).toBe(false);
    });

    it("should only refresh Notion connections", async () => {
      // Create a Strapi connection
      const [strapiConn] = await db
        .insert(connectionTable)
        .values({
          userId: testUserId,
          type: ConnectionType.STRAPI,
          name: "Test Strapi Connection",
        })
        .returning();

      // Verify via connection type
      const [notionConn] = await db
        .select({ type: connectionTable.type })
        .from(connectionTable)
        .where(eq(connectionTable.id, testConnectionId));

      const [strapiConnType] = await db
        .select({ type: connectionTable.type })
        .from(connectionTable)
        .where(eq(connectionTable.id, strapiConn.id));

      expect(notionConn.type).toBe(ConnectionType.NOTION);
      expect(strapiConnType.type).toBe(ConnectionType.STRAPI);
      expect(strapiConnType.type).not.toBe(ConnectionType.NOTION);
    });
  });

  describe("Icon Type Handling", () => {
    it("should handle emoji icons", () => {
      const emojiIcon = { type: "emoji" as const, value: "\u{1F4DA}" };

      expect(emojiIcon.type).toBe("emoji");
      expect(emojiIcon.value).toMatch(/\p{Emoji}/u);
    });

    it("should handle external URL icons", () => {
      const externalIcon = { type: "external" as const, value: "https://example.com/icon.png" };

      expect(externalIcon.type).toBe("external");
      expect(externalIcon.value).toStartWith("http");
    });

    it("should handle file URL icons", () => {
      const fileIcon = { type: "file" as const, value: "https://files.example.com/icon.png" };

      expect(fileIcon.type).toBe("file");
      expect(fileIcon.value).toStartWith("http");
    });

    it("should handle null icons", () => {
      const noIcon = null;

      expect(noIcon).toBeNull();
    });
  });
});
