import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "./db";
import { connectionTable, userTable, webhookLogTable } from "./schema";

describe("Webhook Logging", () => {
  let connectionId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "webhook-test@test.com" })
      .returning();

    const [connection] = await db
      .insert(connectionTable)
      .values({ userId: user.id, type: ConnectionType.STRAPI, name: "Test Connection" })
      .returning();
    connectionId = connection.id;
  });

  describe("logWebhookEvent", () => {
    it("should log webhook event with correct userId type (number)", async () => {
      await db.insert(webhookLogTable).values({
        connectionId,
        event: "entry.publish",
        model: "article",
        status: "success",
        itemsBroadcast: 5,
      });

      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.connectionId).toBe(connectionId);
      expect(typeof log.connectionId).toBe("number");
      expect(log.status).toBe("success");
      expect(log.itemsBroadcast).toBe(5);
    });

    it("should log error status with error message", async () => {
      await db.insert(webhookLogTable).values({
        connectionId,
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
      await db.insert(webhookLogTable).values({
        connectionId,
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
      await db.insert(webhookLogTable).values({
        connectionId,
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
    it("should use number for connectionId matching connection table FK", async () => {
      await db.insert(webhookLogTable).values({
        connectionId,
        event: "entry.publish",
        status: "success",
        itemsBroadcast: 0,
      });

      const [log] = await db.select().from(webhookLogTable).limit(1);
      expect(log.connectionId).toBe(connectionId);
    });
  });
});
