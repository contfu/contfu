import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { collectionTable, quotaTable, userTable } from "../../infra/db/schema";
import { createCollection } from "./createCollection";

describe("createCollection DB quota fallback", () => {
  let userId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "collections-dbquota@test.com" })
      .returning();
    userId = user.id;
  });

  it("rejects creation when the KV entry is missing but DB quota is exhausted", async () => {
    await db.insert(quotaTable).values({
      id: userId,
      maxConnections: 5,
      maxCollections: 1,
      maxFlows: 5,
      maxItems: 100,
    });
    await db.insert(collectionTable).values({
      userId,
      displayName: "Existing",
      name: "existing",
    });

    try {
      await runTest(
        userId,
        createCollection(userId, {
          displayName: "Blocked",
        }),
      );
      throw new Error("Expected quota error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "QuotaError",
        resource: "collections",
        current: 1,
        max: 1,
      });
    }
  });
});
