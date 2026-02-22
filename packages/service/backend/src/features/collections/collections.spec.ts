import { SourceType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import {
  connectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { createCollection } from "./createCollection";
import { deleteCollection } from "./deleteCollection";
import { getCollection } from "./getCollection";
import { listCollections } from "./listCollections";
import { updateCollection } from "./updateCollection";

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Collection Features Happy Path", () => {
  let userId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "collections-happy@test.com" })
      .returning();
    userId = user.id;
  });

  it("should create, update, and delete a collection", async () => {
    const created = await runTest(createCollection(userId, { name: "Initial Collection" }));
    expect(created.name).toBe("Initial Collection");
    expect(created.influxCount).toBe(0);
    expect(created.connectionCount).toBe(0);

    const updated = await runTest(
      updateCollection(userId, created.id, { name: "Updated Collection" }),
    );
    expect(updated).toBe(true);

    const fetched = await runTest(getCollection(userId, created.id));
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe("Updated Collection");

    const deleted = await runTest(deleteCollection(userId, created.id));
    expect(deleted).toBe(true);

    const afterDelete = await runTest(getCollection(userId, created.id));
    expect(afterDelete).toBeNull();
  });

  it("should list collections with influx and connection counts", async () => {
    const created = await runTest(createCollection(userId, { name: "Articles" }));

    const [source] = await db
      .insert(sourceTable)
      .values({
        userId,
        uid: crypto.randomUUID(),
        name: "Source",
        type: SourceType.STRAPI,
      })
      .returning();
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId,
        sourceId: source.id,
        name: "Articles",
      })
      .returning();
    const [consumer] = await db
      .insert(consumerTable)
      .values({
        userId,
        name: "Consumer",
      })
      .returning();

    await db.insert(influxTable).values({
      userId,
      collectionId: created.id,
      sourceCollectionId: sourceCollection.id,
      schema: null,
      filters: null,
    });
    await db.insert(connectionTable).values({
      userId,
      consumerId: consumer.id,
      collectionId: created.id,
    });

    const listed = await runTest(listCollections(userId));
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
    expect(listed[0].influxCount).toBe(1);
    expect(listed[0].connectionCount).toBe(1);

    const fetched = await runTest(getCollection(userId, created.id));
    expect(fetched).toBeDefined();
    expect(fetched!.influxCount).toBe(1);
    expect(fetched!.connectionCount).toBe(1);
  });
});
