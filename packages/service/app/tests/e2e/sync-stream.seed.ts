/**
 * Sync stream E2E test seed data.
 * Called by global-setup.ts before the server starts.
 * Constants are shared with sync-stream.e2e.ts.
 */
import { pack } from "msgpackr";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";

/** Well-known 32-byte consumer key — must match the test file. */
export const SYNC_CONSUMER_KEY = Buffer.from(
  "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
  "hex",
);

/**
 * Seeds a consumer + collection for sync stream tests.
 * No source/influx is needed — fetchAndStreamItems yields nothing,
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

  // Idempotent — skip if the sync consumer key already exists
  const [existing] = await db
    .select({ id: consumerTable.id })
    .from(consumerTable)
    .where(eq(consumerTable.key, SYNC_CONSUMER_KEY))
    .limit(1);

  if (existing) return;

  // Target collection (no source needed for empty snapshot)
  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Test Sync Collection",
      name: "Test Sync Collection",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;
  const colId = collection.id;

  // Consumer with fixed well-known key
  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: SYNC_CONSUMER_KEY,
      name: "Test Sync Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;
  const consumerId = consumer.id;

  // Connection: consumer → collection
  await db.insert(consumerCollectionTable).values({
    userId,
    consumerId,
    collectionId: colId,
  });
}
