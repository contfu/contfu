/**
 * Contentful Webhook E2E test seed data.
 * Called by global-setup.ts before the server starts.
 */
import { SourceType } from "@contfu/core";
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

export const SOURCE_UID = "00000002-0000-4000-a000-000000000001";

const MOCK_SPACE_ID = "abc123def456";
const MOCK_CONTENT_TYPE = "blogPost";
const MOCK_TOKEN = "mock-contentful-token";

export async function seedContentfulWebhookData(db: any): Promise<void> {
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

  const [existing] = await db
    .select({ id: sourceTable.id })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.uid, SOURCE_UID)))
    .limit(1);

  if (existing) return;

  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: SOURCE_UID,
      name: "Test Contentful Webhook Source",
      type: SourceType.CONTENTFUL,
      credentials: encryptedCredentials,
      url: `https://cdn.contentful.com/spaces/${MOCK_SPACE_ID}`,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;
  const sourceId = source.id;

  const ref = Buffer.from(MOCK_CONTENT_TYPE, "utf8");
  const [sourceCollection] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId,
      name: "Blog Post",
      ref,
    })
    .returning({ id: sourceCollectionTable.id });
  if (!sourceCollection) return;
  const scId = sourceCollection.id;

  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Contentful Webhook Collection",
      name: "Test Contentful Webhook Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;
  const colId = collection.id;

  await db.insert(influxTable).values({
    userId,
    collectionId: colId,
    sourceCollectionId: scId,
  });

  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: crypto.randomBytes(32),
      name: "Test Contentful Webhook Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;
  const consumerId = consumer.id;

  await db.insert(connectionTable).values({
    userId,
    consumerId,
    collectionId: colId,
  });
}
