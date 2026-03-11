import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { collectionTable, userTable } from "../../infra/db/schema";
import { createConnection } from "./createConnection";
import { deleteConnection } from "./deleteConnection";
import { getConnectionWithCollectionCount } from "./getConnectionWithCollectionCount";
import { getConnectionWithCredentials } from "./getConnectionWithCredentials";
import { listConnections } from "./listConnections";
import { renameConnection } from "./renameConnection";
import { updateConnection } from "./updateConnection";

describe("Connection Features", () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "connections@test.com" })
      .returning();
    userId = user.id;

    const [other] = await db
      .insert(userTable)
      .values({ name: "Other User", email: "other@test.com" })
      .returning();
    otherUserId = other.id;
  });

  it("should create and list connections", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
        accountId: "workspace-123",
        credentials: Buffer.from("token-abc"),
      }),
    );

    expect(created.type).toBe(ConnectionType.NOTION);
    expect(created.name).toBe("Notion");
    expect(created.accountId).toBe("workspace-123");
    expect(created.hasCredentials).toBe(true);

    const all = await runTest(userId, listConnections());
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });

  it("should decrypt credentials via getConnectionWithCredentials", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
        credentials: Buffer.from("secret-token"),
      }),
    );

    const internal = await runTest(userId, getConnectionWithCredentials(created.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("secret-token"));
  });

  it("should rename a connection", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
      }),
    );

    const renamed = await runTest(userId, renameConnection(created.id, "My Workspace"));
    expect(renamed).toBeDefined();
    expect(renamed!.name).toBe("My Workspace");
  });

  it("should update encrypted credentials", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
        credentials: Buffer.from("old-token"),
      }),
    );

    const updated = await runTest(
      userId,
      updateConnection(created.id, {
        credentials: Buffer.from("new-token"),
      }),
    );

    expect(updated).toBeDefined();

    const internal = await runTest(userId, getConnectionWithCredentials(created.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("new-token"));
  });

  it("should delete a connection", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
      }),
    );

    const deleted = await runTest(userId, deleteConnection(created.id));
    expect(deleted).toBe(true);

    const all = await runTest(userId, listConnections());
    expect(all).toHaveLength(0);
  });

  it("should isolate connections by user (RLS)", async () => {
    await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "User 1 Notion",
      }),
    );

    await runTest(
      otherUserId,
      createConnection(otherUserId, {
        type: ConnectionType.NOTION,
        name: "User 2 Notion",
      }),
    );

    const user1List = await runTest(userId, listConnections());
    expect(user1List).toHaveLength(1);
    expect(user1List[0].name).toBe("User 1 Notion");

    const user2List = await runTest(otherUserId, listConnections());
    expect(user2List).toHaveLength(1);
    expect(user2List[0].name).toBe("User 2 Notion");
  });

  it("should not allow deleting another user's connection", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "My Notion",
      }),
    );

    const deleted = await runTest(otherUserId, deleteConnection(created.id));
    expect(deleted).toBe(false);
  });

  it("should get connection with collection count (JOIN query)", async () => {
    const created = await runTest(
      userId,
      createConnection(userId, {
        type: ConnectionType.NOTION,
        name: "Notion",
      }),
    );

    // Connection with no collections should have count 0
    const withoutCollections = await runTest(userId, getConnectionWithCollectionCount(created.id));
    expect(withoutCollections).toBeDefined();
    expect(withoutCollections!.collectionCount).toBe(0);

    // Add 2 collections to this connection
    await db.insert(collectionTable).values([
      { userId, connectionId: created.id, displayName: "Collection A", name: "collectionA" },
      { userId, connectionId: created.id, displayName: "Collection B", name: "collectionB" },
    ]);

    const withCollections = await runTest(userId, getConnectionWithCollectionCount(created.id));
    expect(withCollections).toBeDefined();
    expect(withCollections!.collectionCount).toBe(2);
  });
});
