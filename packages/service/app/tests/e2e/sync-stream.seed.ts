/**
 * Sync stream E2E test seed data.
 * Called by global-setup.ts before the server starts.
 * Constants are shared with sync-stream.e2e.ts.
 */
import { pack } from "msgpackr";
import { ConnectionType } from "@contfu/svc-core";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";
import { hashKeyForStorage } from "./seed-utils";

/** Well-known consumer key for sync stream tests. */
export const SYNC_CONSUMER_KEY = Buffer.from("00000000000000000000000000000001", "hex");

/** Well-known consumer name — must match the test file. */
export const SYNC_CONSUMER_NAME = "Test Sync Consumer";

/**
 * Seeds a consumer connection + collection and a target collection for sync stream tests.
 * No source/flow is needed — fetchAndStreamItems yields nothing,
 * producing an immediate empty snapshot (SNAPSHOT_START → SNAPSHOT_END).
 */
export async function seedSyncData(db: any): Promise<void> {
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

  // Idempotent — skip if the sync consumer client connection already exists
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(eq(connectionTable.name, "Test Sync Client"))
    .limit(1);

  if (existing) return;

  // Target collection (no source needed for empty snapshot)
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Sync Collection",
      name: "Test Sync Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Client connection (replaces consumer)
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.APP,
      name: "Test Sync Client",
      credentials: hashKeyForStorage(SYNC_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: SYNC_CONSUMER_NAME,
      displayName: SYNC_CONSUMER_NAME,
    })
    .returning({ id: collectionTable.id });
  if (!consumerCollection) return;

  // Flow: target → consumer collection (replaces outflow)
  await db.insert(flowTable).values({
    userId,
    sourceId: targetCollection.id,
    targetId: consumerCollection.id,
  });
}
