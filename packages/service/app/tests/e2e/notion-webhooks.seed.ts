/**
 * Webhook E2E test seed data.
 * Called by global-setup.ts before the server starts.
 * Constants are shared with notion-webhooks.e2e.ts.
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

/** Well-known test source UID — must match the test file. */
export const SOURCE_UID = "00000001-0000-4000-a000-000000000001";

const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_TOKEN = "mock-notion-token";

/**
 * Seeds the full webhook test pipeline:
 * connection (source) → source collection → target collection → flow (source→target)
 * connection (client) → consumer collection → flow (target→consumer)
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
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.uid, SOURCE_UID)))
    .limit(1);

  if (existing) return;

  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  // Source connection (Notion)
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.NOTION,
      name: "Test Notion Webhook Connection",
      credentials: encryptedCredentials,
      uid: SOURCE_UID,
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection (external collection equivalent, ref = mock Notion database ID)
  const ref = Buffer.from(MOCK_DATABASE_ID.replace(/-/g, ""), "hex");
  const [sourceCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Test Notion Database",
      displayName: "Test Notion Database",
      ref,
    })
    .returning({ id: collectionTable.id });
  if (!sourceCollection) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Webhook Collection",
      name: "Test Webhook Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow: source collection → target collection (replaces inflow)
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
      type: ConnectionType.APP,
      name: "Notion Webhook Client",
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection (bound to client connection)
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: "Test Webhook Consumer",
      displayName: "Test Webhook Consumer",
    })
    .returning({ id: collectionTable.id });
  if (!consumerCollection) return;

  // Flow: target collection → consumer collection (replaces outflow)
  await db.insert(flowTable).values({
    userId,
    sourceId: targetCollection.id,
    targetId: consumerCollection.id,
  });
}
