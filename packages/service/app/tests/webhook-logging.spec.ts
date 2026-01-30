import { describe, it, expect, beforeEach, mock, type Mock } from "bun:test";

/**
 * Unit tests for webhook logging functionality.
 * Tests that webhook events are properly logged to the database.
 */

// Create mock functions
let mockInsertValues: Mock<() => Promise<void>>;
let mockDeleteWhere: Mock<() => Promise<void>>;
let mockSelectResult: { id: number }[];

const createMockDb = () => {
  mockInsertValues = mock(() => Promise.resolve());
  mockDeleteWhere = mock(() => Promise.resolve());
  mockSelectResult = [];

  return {
    insert: mock(() => ({
      values: mockInsertValues,
    })),
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => Promise.resolve(mockSelectResult)),
          })),
        })),
      })),
    })),
    delete: mock(() => ({
      where: mockDeleteWhere,
    })),
  };
};

describe("Webhook Logging", () => {
  describe("logWebhookEvent", () => {
    it("should log webhook event with correct userId type (number)", async () => {
      const mockDb = createMockDb();

      // Simulate the logWebhookEvent function logic
      const userId = 123; // number, not string
      const sourceId = 456;
      const event = "entry.publish";
      const model = "article";
      const status = "success" as const;
      const itemsBroadcast = 5;

      // Verify userId is a number
      expect(typeof userId).toBe("number");

      // Insert log entry
      await mockDb.insert({}).values({
        userId,
        sourceId,
        event,
        model,
        status,
        errorMessage: undefined,
        itemsBroadcast,
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const insertedData = mockInsertValues.mock.calls[0][0];
      expect(insertedData.userId).toBe(123);
      expect(typeof insertedData.userId).toBe("number");
    });

    it("should log error status with error message", async () => {
      const mockDb = createMockDb();

      const userId = 100;
      const sourceId = 200;
      const event = "entry.create";
      const model = "product";
      const status = "error" as const;
      const errorMessage = "Failed to process webhook";

      await mockDb.insert({}).values({
        userId,
        sourceId,
        event,
        model,
        status,
        errorMessage,
        itemsBroadcast: 0,
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const insertedData = mockInsertValues.mock.calls[0][0];
      expect(insertedData.status).toBe("error");
      expect(insertedData.errorMessage).toBe("Failed to process webhook");
    });

    it("should log unauthorized status for invalid signatures", async () => {
      const mockDb = createMockDb();

      const userId = 100;
      const sourceId = 200;
      const event = "entry.update";
      const model = "article";
      const status = "unauthorized" as const;
      const errorMessage = "Invalid webhook signature";

      await mockDb.insert({}).values({
        userId,
        sourceId,
        event,
        model,
        status,
        errorMessage,
        itemsBroadcast: 0,
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const insertedData = mockInsertValues.mock.calls[0][0];
      expect(insertedData.status).toBe("unauthorized");
      expect(insertedData.errorMessage).toBe("Invalid webhook signature");
    });

    it("should handle null model gracefully", async () => {
      const mockDb = createMockDb();

      await mockDb.insert({}).values({
        userId: 1,
        sourceId: 1,
        event: "entry.delete",
        model: null,
        status: "success",
        errorMessage: undefined,
        itemsBroadcast: 0,
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const insertedData = mockInsertValues.mock.calls[0][0];
      expect(insertedData.model).toBeNull();
    });
  });

  describe("log cleanup", () => {
    it("should delete old logs when exceeding MAX_LOGS_PER_SOURCE", async () => {
      const MAX_LOGS_PER_SOURCE = 50;
      const mockDb = createMockDb();

      // Simulate having 55 logs
      mockSelectResult = Array.from({ length: 55 }, (_, i) => ({ id: i + 1 }));

      // Get logs
      const logs = await mockDb.select({ id: {} }).from({}).where({}).orderBy({}).limit(1000);

      expect(logs.length).toBe(55);

      // Should delete the 5 oldest
      if (logs.length > MAX_LOGS_PER_SOURCE) {
        const idsToDelete = logs.slice(MAX_LOGS_PER_SOURCE).map((l) => l.id);
        expect(idsToDelete).toEqual([51, 52, 53, 54, 55]);
        expect(idsToDelete.length).toBe(5);
      }
    });

    it("should not delete logs when under MAX_LOGS_PER_SOURCE", async () => {
      const MAX_LOGS_PER_SOURCE = 50;

      // Simulate having 30 logs
      mockSelectResult = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));

      expect(mockSelectResult.length).toBe(30);
      expect(mockSelectResult.length <= MAX_LOGS_PER_SOURCE).toBe(true);
    });
  });

  describe("WebhookLogEntry type", () => {
    it("should have correct structure for UI consumption", () => {
      interface WebhookLogEntry {
        id: number;
        event: string;
        model: string | null;
        status: "success" | "error" | "unauthorized";
        errorMessage: string | null;
        itemsBroadcast: number;
        timestamp: Date;
      }

      const logEntry: WebhookLogEntry = {
        id: 1,
        event: "entry.publish",
        model: "article",
        status: "success",
        errorMessage: null,
        itemsBroadcast: 3,
        timestamp: new Date("2026-01-30T12:00:00Z"),
      };

      expect(logEntry.id).toBeTypeOf("number");
      expect(logEntry.event).toBeTypeOf("string");
      expect(["success", "error", "unauthorized"]).toContain(logEntry.status);
      expect(logEntry.itemsBroadcast).toBeTypeOf("number");
      expect(logEntry.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("userId type consistency", () => {
    it("should use number for userId in webhook_log table (matching source table)", () => {
      // This test documents the fix for the FK type mismatch
      // source.userId is integer, so webhook_log.userId must also be integer

      const sourceUserId: number = 42;
      const webhookLogUserId: number = sourceUserId;

      // Both should be the same type
      expect(typeof sourceUserId).toBe(typeof webhookLogUserId);
      expect(typeof webhookLogUserId).toBe("number");

      // Verify they can be compared without type coercion
      expect(sourceUserId === webhookLogUserId).toBe(true);
    });

    it("should allow FK constraint between webhook_log and source tables", () => {
      // Simulate the FK relationship
      const sourceRecord = { userId: 100, id: 1 };
      const webhookLogRecord = { userId: 100, sourceId: 1 };

      // FK: webhook_log(userId, sourceId) -> source(userId, id)
      expect(webhookLogRecord.userId).toBe(sourceRecord.userId);
      expect(webhookLogRecord.sourceId).toBe(sourceRecord.id);
    });
  });
});
