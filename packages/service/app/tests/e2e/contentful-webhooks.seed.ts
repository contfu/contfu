/**
 * Contentful Webhook E2E test seed data.
 * Called by global-setup.ts before the server starts.
 */
import { ConnectionType } from "@contfu/core";
import { pack } from "msgpackr";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { and, eq } from "drizzle-orm";

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

  // Idempotent check
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.uid, SOURCE_UID)))
    .limit(1);

  if (existing) return;

  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  // Source connection (Contentful)
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.CONTENTFUL,
      name: "Test Contentful Webhook Connection",
      credentials: encryptedCredentials,
      url: `https://cdn.contentful.com/spaces/${MOCK_SPACE_ID}`,
      uid: SOURCE_UID,
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection (external collection equivalent)
  const ref = Buffer.from(MOCK_CONTENT_TYPE, "utf8");
  const [sourceCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Blog Post",
      displayName: "Blog Post",
      ref,
    })
    .returning({ id: collectionTable.id });
  if (!sourceCollection) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Contentful Webhook Collection",
      name: "Test Contentful Webhook Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow: source → target (replaces inflow)
  await db.insert(flowTable).values({
    userId,
    sourceId: sourceCollection.id,
    targetId: targetCollection.id,
  });

  // Client connection (replaces consumer)
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.CLIENT,
      name: "Contentful Webhook Client",
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: "Test Contentful Webhook Consumer",
      displayName: "Test Contentful Webhook Consumer",
    })
    .returning({ id: collectionTable.id });
  if (!consumerCollection) return;

  // Flow: target → consumer (replaces outflow)
  await db.insert(flowTable).values({
    userId,
    sourceId: targetCollection.id,
    targetId: consumerCollection.id,
  });
}
