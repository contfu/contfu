import { db } from "@contfu/svc-backend/infra/db/db";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  userTable,
  sourceTable,
  sourceCollectionTable,
  collectionTable,
  influxTable,
  consumerTable,
  connectionTable,
} from "@contfu/svc-backend/infra/db/schema";
import { SourceType } from "@contfu/core";
import { uuidToBuffer } from "@contfu/svc-sources";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

const SOURCE_UID = "test-notion-webhook-uid";
const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_TOKEN = "mock-notion-token";
const CONSUMER_KEY = crypto.randomBytes(32);

export const POST: RequestHandler = async () => {
  if (process.env.TEST_MODE !== "true") {
    return new Response("Not available", { status: 403 });
  }

  // Find test user
  const [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) {
    return Response.json({ error: "Test user not found" }, { status: 404 });
  }

  const userId = user.id;

  // Check if source already exists (idempotent)
  const [existingSource] = await db
    .select({ id: sourceTable.id, uid: sourceTable.uid })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.uid, SOURCE_UID)))
    .limit(1);

  if (existingSource) {
    // Return existing data
    const [sc] = await db
      .select({ id: sourceCollectionTable.id })
      .from(sourceCollectionTable)
      .where(
        and(
          eq(sourceCollectionTable.userId, userId),
          eq(sourceCollectionTable.sourceId, existingSource.id),
        ),
      )
      .limit(1);
    const [col] = await db
      .select({ id: collectionTable.id })
      .from(collectionTable)
      .where(eq(collectionTable.userId, userId))
      .limit(1);
    const [con] = await db
      .select({ key: consumerTable.key })
      .from(consumerTable)
      .where(eq(consumerTable.userId, userId))
      .limit(1);

    return Response.json({
      sourceUid: SOURCE_UID,
      consumerKey: con?.key ? Buffer.from(con.key).toString("base64url") : null,
      collectionId: col?.id ?? null,
      sourceCollectionId: sc?.id ?? null,
    });
  }

  // Create source
  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  const maxSourceId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .limit(1);
  const sourceId = (maxSourceId[0]?.maxId ?? 0) + 1;

  await db.insert(sourceTable).values({
    userId,
    id: sourceId,
    uid: SOURCE_UID,
    name: "Test Notion Webhook Source",
    type: SourceType.NOTION,
    credentials: encryptedCredentials,
  });

  // Create source collection with ref = MOCK_DATABASE_ID
  const ref = uuidToBuffer(MOCK_DATABASE_ID);
  const maxScId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(sourceCollectionTable)
    .where(eq(sourceCollectionTable.userId, userId))
    .limit(1);
  const scId = (maxScId[0]?.maxId ?? 0) + 1;

  await db.insert(sourceCollectionTable).values({
    userId,
    sourceId,
    id: scId,
    name: "Test Notion Database",
    ref,
  });

  // Create target collection
  const maxColId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .limit(1);
  const colId = (maxColId[0]?.maxId ?? 0) + 1;

  await db.insert(collectionTable).values({
    userId,
    id: colId,
    name: "Test Webhook Collection",
  });

  // Create influx: sourceCollection -> collection (no filters)
  const maxInfluxId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(influxTable)
    .where(eq(influxTable.userId, userId))
    .limit(1);
  const influxId = (maxInfluxId[0]?.maxId ?? 0) + 1;

  await db.insert(influxTable).values({
    userId,
    id: influxId,
    collectionId: colId,
    sourceCollectionId: scId,
  });

  // Create consumer with known key
  const maxConsumerId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(consumerTable)
    .where(eq(consumerTable.userId, userId))
    .limit(1);
  const consumerId = (maxConsumerId[0]?.maxId ?? 0) + 1;

  await db.insert(consumerTable).values({
    userId,
    id: consumerId,
    key: CONSUMER_KEY,
    name: "Test Webhook Consumer",
  });

  // Create connection: consumer -> collection
  await db.insert(connectionTable).values({
    userId,
    consumerId,
    collectionId: colId,
  });

  return Response.json({
    sourceUid: SOURCE_UID,
    consumerKey: Buffer.from(CONSUMER_KEY).toString("base64url"),
    collectionId: colId,
    sourceCollectionId: scId,
  });
};
