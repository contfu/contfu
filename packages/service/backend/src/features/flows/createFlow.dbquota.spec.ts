import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { collectionTable, flowTable, quotaTable, userTable } from "../../infra/db/schema";
import { createFlow } from "./createFlow";

describe("createFlow DB quota fallback", () => {
  let userId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "flows-dbquota@test.com" })
      .returning();
    userId = user.id;
  });

  it("rejects creation when the KV entry is missing but DB quota is exhausted", async () => {
    await db.insert(quotaTable).values({
      id: userId,
      maxConnections: 5,
      maxCollections: 5,
      maxFlows: 1,
      maxItems: 100,
    });

    const [source] = await db
      .insert(collectionTable)
      .values({ userId, displayName: "Source", name: "source" })
      .returning();
    const [mid] = await db
      .insert(collectionTable)
      .values({ userId, displayName: "Mid", name: "mid" })
      .returning();
    const [target] = await db
      .insert(collectionTable)
      .values({ userId, displayName: "Target", name: "target" })
      .returning();

    await db.insert(flowTable).values({
      userId,
      sourceId: source.id,
      targetId: mid.id,
    });

    try {
      await runTest(userId, createFlow(userId, { sourceId: mid.id, targetId: target.id }));
      throw new Error("Expected quota error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "QuotaError",
        resource: "flows",
        current: 1,
        max: 1,
      });
    }
  });
});
