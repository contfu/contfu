import { beforeEach, describe, expect, it } from "bun:test";
import { truncateAllTables } from "../../../../test/setup";
import { db } from "./db";
import { sourceTable, userTable, webhookLogTable } from "./schema";

/**
 * Unit tests for webhook logging functionality.
 * Uses real in-memory SQLite database, not mocks.
 *
 * Note: These tests require the real database and will be skipped
 * if running in an environment where db is mocked by other tests.
 */

// Check if db is mocked (mocked db won't have delete as a function)
const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Webhook Logging", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  describe("logWebhookEvent", () => {
    it("should log webhook event with correct userId type (number)", async () => {
      // Create test user and source first (FK constraints)
      const [user] = await db
        .insert(userTable)
        .values({
          name: "Test User",
          email: "webhook-test@test.com",
        })
        .returning();

      const [source] = await db
        .insert(sourceTable)
        .values({
          userId: user.id,
          id: 1,
          type: 1,
          name: "Test Source",
        })
        .returning();

      // Insert webhook log
      await db.insert(webhookLogTable).values({
        userId: user.id,
        sourceId: source.id,
        event: "entry.publish",
        model: "article",
        status: "success",
        itemsBroadcast: 5,
      });

      // Verify
      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.userId).toBe(user.id);
      expect(typeof log.userId).toBe("number");
      expect(log.status).toBe("success");
      expect(log.itemsBroadcast).toBe(5);
    });

    it("should log error status with error message", async () => {
      const [user] = await db
        .insert(userTable)
        .values({
          name: "Test User",
          email: "webhook-error@test.com",
        })
        .returning();

      const [source] = await db
        .insert(sourceTable)
        .values({
          userId: user.id,
          id: 1,
          type: 1,
          name: "Test Source",
        })
        .returning();

      await db.insert(webhookLogTable).values({
        userId: user.id,
        sourceId: source.id,
        event: "entry.create",
        model: "product",
        status: "error",
        errorMessage: "Failed to process webhook",
        itemsBroadcast: 0,
      });

      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.status).toBe("error");
      expect(log.errorMessage).toBe("Failed to process webhook");
    });

    it("should log unauthorized status for invalid signatures", async () => {
      const [user] = await db
        .insert(userTable)
        .values({
          name: "Test User",
          email: "webhook-unauth@test.com",
        })
        .returning();

      const [source] = await db
        .insert(sourceTable)
        .values({
          userId: user.id,
          id: 1,
          type: 1,
          name: "Test Source",
        })
        .returning();

      await db.insert(webhookLogTable).values({
        userId: user.id,
        sourceId: source.id,
        event: "entry.update",
        model: "article",
        status: "unauthorized",
        errorMessage: "Invalid webhook signature",
        itemsBroadcast: 0,
      });

      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.status).toBe("unauthorized");
      expect(log.errorMessage).toBe("Invalid webhook signature");
    });

    it("should handle null model gracefully", async () => {
      const [user] = await db
        .insert(userTable)
        .values({
          name: "Test User",
          email: "webhook-null@test.com",
        })
        .returning();

      const [source] = await db
        .insert(sourceTable)
        .values({
          userId: user.id,
          id: 1,
          type: 1,
          name: "Test Source",
        })
        .returning();

      await db.insert(webhookLogTable).values({
        userId: user.id,
        sourceId: source.id,
        event: "entry.delete",
        model: null,
        status: "success",
        itemsBroadcast: 0,
      });

      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.model).toBeNull();
    });
  });

  describe("userId type consistency", () => {
    it("should use number for userId matching source table FK", async () => {
      const [user] = await db
        .insert(userTable)
        .values({
          name: "FK Test User",
          email: "fk-test@test.com",
        })
        .returning();

      const [source] = await db
        .insert(sourceTable)
        .values({
          userId: user.id,
          id: 1,
          type: 1,
          name: "FK Test Source",
        })
        .returning();

      await db.insert(webhookLogTable).values({
        userId: user.id,
        sourceId: source.id,
        event: "entry.publish",
        status: "success",
        itemsBroadcast: 0,
      });

      // Verify FK relationship works
      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.userId).toBe(source.userId);
      expect(log.sourceId).toBe(source.id);
    });
  });
});
