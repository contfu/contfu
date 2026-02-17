/**
 * Webhook E2E test seed data.
 * Called by global-setup.ts before the server starts.
 * Constants are shared with notion-webhooks.e2e.ts.
 */
import { SourceType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

/** Well-known test source UID — must match the test file. */
export const SOURCE_UID = "00000001-0000-4000-a000-000000000001";

const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_TOKEN = "mock-notion-token";

/**
 * Seeds the full webhook test pipeline:
 * source → source collection → collection → influx → consumer → connection.
 */
export async function seedWebhookData(db: any): Promise<void> {
  const [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) return;

  const userId = user.id;

  // Idempotent — skip if already seeded
  const [existing] = await db
    .select({ id: sourceTable.id })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.uid, SOURCE_UID)))
    .limit(1);

  if (existing) return;

  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  // Source
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

  // Source collection (ref = mock Notion database ID)
  const ref = Buffer.from(MOCK_DATABASE_ID.replace(/-/g, ""), "hex");
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

  // Target collection
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

  // Influx: source collection → collection
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

  // Consumer
  const maxConsumerId = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(consumerTable)
    .where(eq(consumerTable.userId, userId))
    .limit(1);
  const consumerId = (maxConsumerId[0]?.maxId ?? 0) + 1;

  await db.insert(consumerTable).values({
    userId,
    id: consumerId,
    key: crypto.randomBytes(32),
    name: "Test Webhook Consumer",
  });

  // Connection: consumer → collection
  await db.insert(connectionTable).values({
    userId,
    consumerId,
    collectionId: colId,
  });
}
