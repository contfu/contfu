/**
 * Webhook E2E test seed data.
 * Called by global-setup.ts before the server starts.
 * Constants are shared with notion-webhooks.e2e.ts.
 */
import { SourceType } from "@contfu/svc-core";
import { pack } from "msgpackr";
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
import { and, eq } from "drizzle-orm";
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
  let [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "test@test.com",
        emailVerified: true,
        approved: true,
      })
      .returning({ id: userTable.id });
  }

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
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: SOURCE_UID,
      name: "Test Notion Webhook Source",
      type: SourceType.NOTION,
      credentials: encryptedCredentials,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;
  const sourceId = source.id;

  // Source collection (ref = mock Notion database ID)
  const ref = Buffer.from(MOCK_DATABASE_ID.replace(/-/g, ""), "hex");
  const [sourceCollection] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId,
      name: "Test Notion Database",
      ref,
    })
    .returning({ id: sourceCollectionTable.id });
  if (!sourceCollection) return;
  const scId = sourceCollection.id;

  // Target collection
  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Webhook Collection",
      name: "Test Webhook Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;
  const colId = collection.id;

  // Influx: source collection → collection
  await db.insert(influxTable).values({
    userId,
    collectionId: colId,
    sourceCollectionId: scId,
  });

  // Consumer
  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: crypto.randomBytes(32),
      name: "Test Webhook Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;
  const consumerId = consumer.id;

  // Connection: consumer → collection
  await db.insert(connectionTable).values({
    userId,
    consumerId,
    collectionId: colId,
  });
}
