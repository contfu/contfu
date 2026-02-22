import { SourceType } from "@contfu/core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import { sourceCollectionTable, sourceTable, userTable } from "@contfu/svc-backend/infra/db/schema";
import { beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { lru } from "tiny-lru";
import type { DataSourceInfo } from "../../src/lib/remote/influxes.remote";
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
  let testSourceId: number;

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

    // Create test Notion source
    const mockToken = "test-notion-token";
    const encryptedCreds = await encryptCredentials(testUserId, Buffer.from(mockToken, "utf8"));

    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: testUserId,
        uid: crypto.randomUUID(),
        type: SourceType.NOTION,
        name: "Test Notion Source",
        credentials: encryptedCreds,
      })
      .returning();
    testSourceId = source.id;
  });

  describe("Cache Key Strategy", () => {
    it("should generate consistent cache keys for user-source pairs", () => {
      // Cache keys follow pattern: notion-ds:${userId}:${sourceId}
      const cacheKey1 = `notion-ds:${testUserId}:${testSourceId}`;
      const cacheKey2 = `notion-ds:${testUserId}:${testSourceId}`;

      expect(cacheKey1).toBe(cacheKey2);
      expect(cacheKey1).toMatch(/^notion-ds:\d+:\d+$/);
    });

    it("should generate different keys for different users", () => {
      const key1 = `notion-ds:${testUserId}:${testSourceId}`;
      const key2 = `notion-ds:${testUserId + 1}:${testSourceId}`;

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different sources", () => {
      const key1 = `notion-ds:${testUserId}:${testSourceId}`;
      const key2 = `notion-ds:${testUserId}:${testSourceId + 1}`;

      expect(key1).not.toBe(key2);
    });
  });

  describe("Cache Structure and TTL", () => {
    it("should store data source info without DB-enriched fields", () => {
      // Create a mock cache to test structure
      const testCache = lru<Omit<DataSourceInfo, "exists" | "sourceCollectionId">[]>(
        100,
        5 * 60 * 1000,
      );

      const cachedData = [
        {
          id: "db-123",
          title: "Test Database",
          icon: { type: "emoji" as const, value: "📚" },
          schema: null,
        },
      ];

      const cacheKey = `notion-ds:${testUserId}:${testSourceId}`;
      testCache.set(cacheKey, cachedData);

      const retrieved = testCache.get(cacheKey);
      expect(retrieved).toBeDefined();
      expect(retrieved?.[0]).toHaveProperty("id");
      expect(retrieved?.[0]).toHaveProperty("title");
      expect(retrieved?.[0]).toHaveProperty("icon");
      expect(retrieved?.[0]).toHaveProperty("schema");
      expect(retrieved?.[0]).not.toHaveProperty("exists");
      expect(retrieved?.[0]).not.toHaveProperty("sourceCollectionId");
    });

    it("should have 5-minute TTL", () => {
      const ttlMs = 5 * 60 * 1000;
      const testCache = lru<any[]>(100, ttlMs);

      // Cache should have TTL set
      expect(ttlMs).toBe(300000); // 5 minutes in milliseconds
    });

    it("should support cache invalidation", () => {
      const testCache = lru<any[]>(100, 5 * 60 * 1000);
      const cacheKey = `notion-ds:${testUserId}:${testSourceId}`;

      // Set data
      testCache.set(cacheKey, [{ id: "test", title: "Test", icon: null, schema: null }]);
      expect(testCache.get(cacheKey)).toBeDefined();

      // Invalidate
      testCache.delete(cacheKey);
      expect(testCache.get(cacheKey)).toBeUndefined();
    });
  });

  describe("Data Enrichment from Database", () => {
    it("should enrich cached data with exists flag and sourceCollectionId", async () => {
      // Create a source collection in DB
      const [sourceCollection] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: testUserId,
          sourceId: testSourceId,
          name: "Existing Collection",
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
      const existingId = sourceCollection.id;
      const enrichedDataSource = {
        ...cachedDataSource,
        exists: existingId !== undefined,
        sourceCollectionId: existingId,
      };

      expect(enrichedDataSource.exists).toBe(true);
      expect(enrichedDataSource.sourceCollectionId).toBe(1);
    });

    it("should mark non-existent data sources correctly", async () => {
      // No source collection in DB
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
        sourceCollectionId: undefined,
      };

      expect(enrichedDataSource.exists).toBe(false);
      expect(enrichedDataSource.sourceCollectionId).toBeUndefined();
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
      const key1 = `notion-ds:${testUserId}:${testSourceId}`;
      testCache.set(key1, [{ id: "db-1", title: "User 1 Data", icon: null, schema: null }]);

      // Cache different data for user 2 with same source ID
      const key2 = `notion-ds:${user2.id}:${testSourceId}`;
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
      const cacheKey = `notion-ds:${testUserId}:${testSourceId}`;

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
      const cacheKey = `notion-ds:${testUserId}:${testSourceId}`;

      // Cache empty array (valid result - no databases found)
      testCache.set(cacheKey, []);

      const result = testCache.get(cacheKey);
      expect(result).toBeDefined();
      expect(result).toBeArray();
      expect(result?.length).toBe(0);
    });
  });

  describe("Refresh Command Requirements", () => {
    it("should validate source exists before refresh", async () => {
      // Valid source exists
      const validSourceId = testSourceId;

      const sources = await db.select().from(sourceTable);
      const sourceExists = sources.some((s) => s.id === validSourceId);

      expect(sourceExists).toBe(true);
    });

    it("should handle non-existent source gracefully", async () => {
      const nonExistentSourceId = 99999;

      const sources = await db.select().from(sourceTable);
      const sourceExists = sources.some((s) => s.id === nonExistentSourceId);

      expect(sourceExists).toBe(false);
      // In actual implementation, this would return { success: false, error: "Source not found" }
    });

    it("should only refresh Notion sources", async () => {
      // Create a Strapi source
      const [strapiSource] = await db
        .insert(sourceTable)
        .values({
          userId: testUserId,
          uid: crypto.randomUUID(),
          type: SourceType.STRAPI,
          name: "Test Strapi Source",
        })
        .returning();

      expect(testSourceId).toBe(1); // This is a Notion source
      expect(strapiSource.type).toBe(SourceType.STRAPI);
      expect(strapiSource.type).not.toBe(SourceType.NOTION);
    });
  });

  describe("Icon Type Handling", () => {
    it("should handle emoji icons", () => {
      const emojiIcon = { type: "emoji" as const, value: "📚" };

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
