import { beforeEach, describe, expect, it } from "bun:test";
import { ConnectionType } from "@contfu/core";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { connectionTable, quotaTable, userTable } from "../../infra/db/schema";
import { createConnection } from "./createConnection";

describe("createConnection DB quota fallback", () => {
  let userId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "connections-dbquota@test.com" })
      .returning();
    userId = user.id;
  });

  it("rejects creation when the KV entry is missing but DB quota is exhausted", async () => {
    await db.insert(quotaTable).values({
      id: userId,
      maxConnections: 1,
      maxCollections: 5,
      maxFlows: 5,
      maxItems: 100,
    });
    await db.insert(connectionTable).values({
      userId,
      type: ConnectionType.NOTION,
      name: "Existing",
    });

    try {
      await runTest(
        userId,
        createConnection(userId, {
          type: ConnectionType.STRAPI,
          name: "Blocked",
        }),
      );
      throw new Error("Expected quota error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "QuotaError",
        resource: "connections",
        current: 1,
        max: 1,
      });
    }
  });
});
