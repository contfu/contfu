import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConnectionType } from "@contfu/core";

// oxlint-disable-next-line typescript-eslint/require-await -- async generator matches the real source signature
const iterateContentTypesMock = mock(async function* () {
  yield { uid: "articles", info: { displayName: "Articles" } };
  yield { uid: "authors", info: { displayName: "Authors" } };
});

void mock.module("@contfu/svc-sources/strapi", () => ({
  iterateContentTypes: iterateContentTypesMock,
}));

import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { evictCachedQuota } from "../../infra/cache/quota-cache";
import { collectionTable, quotaTable, userTable } from "../../infra/db/schema";
import { createConnection } from "../connections/createConnection";
import { createCollection } from "./createCollection";
import { scanCollections } from "./scanCollections";
import { addScannedCollections } from "./addScannedCollections";

describe("scan/add scanned collections", () => {
  let userId: number;
  let connectionId: number;

  beforeEach(async () => {
    iterateContentTypesMock.mockClear();
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "scan-add@test.com" })
      .returning();
    userId = user.id;

    evictCachedQuota(userId);

    const connection = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.STRAPI,
        name: "Strapi",
        url: "https://example.com",
        credentials: Buffer.from("secret"),
      }),
    );
    connectionId = connection.id;
  });

  it("scans collections with alreadyAdded semantics", async () => {
    await runTest(
      userId,
      createCollection(userId, {
        connectionId,
        displayName: "Articles",
        ref: "articles",
      }),
    );

    const scanned = await runTest(userId, scanCollections(connectionId));

    expect(scanned).toEqual([
      { ref: "articles", displayName: "Articles", alreadyAdded: true },
      { ref: "authors", displayName: "Authors", alreadyAdded: false },
    ]);
  });

  it("adds selected scanned collections", async () => {
    const result = await runTest(
      userId,
      addScannedCollections(userId, { connectionId, refs: ["articles"] }),
    );

    expect(result.scanned).toBe(2);
    expect(result.alreadyAdded).toEqual([]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toMatchObject({ ref: "articles", displayName: "Articles" });

    const collections = await db.select().from(collectionTable);
    expect(collections).toHaveLength(1);
    expect(collections[0].displayName).toBe("Articles");
  });

  it("rejects unknown refs", async () => {
    try {
      await runTest(userId, addScannedCollections(userId, { connectionId, refs: ["missing"] }));
      throw new Error("Expected validation error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "ValidationError",
        field: "refs",
      });
    }
  });

  it("rejects refs that are already added", async () => {
    await runTest(
      userId,
      createCollection(userId, {
        connectionId,
        displayName: "Articles",
        ref: "articles",
      }),
    );

    try {
      await runTest(userId, addScannedCollections(userId, { connectionId, refs: ["articles"] }));
      throw new Error("Expected validation error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "ValidationError",
        field: "refs",
        message: expect.stringContaining("already added"),
      });
    }
  });

  it("rejects add-all when it would exceed the collection quota", async () => {
    evictCachedQuota(userId);
    await db.insert(quotaTable).values({
      id: userId,
      maxConnections: 5,
      maxCollections: 1,
      maxFlows: 5,
      maxItems: 100,
    });

    try {
      await runTest(userId, addScannedCollections(userId, { connectionId, all: true }));
      throw new Error("Expected quota error");
    } catch (error) {
      expect(error).toMatchObject({
        _tag: "QuotaError",
        resource: "collections",
        current: 0,
        max: 1,
      });
    }

    const collections = await db.select().from(collectionTable);
    expect(collections).toHaveLength(0);
  });
});
