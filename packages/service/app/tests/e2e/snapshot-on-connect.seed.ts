/**
 * Snapshot-on-connect E2E test seed data.
 *
 * Creates a consumer, collection, and Strapi source/influx — but deliberately
 * does NOT create the consumer-collection. The test creates it via the API to
 * exercise the snapshot-on-connect feature.
 *
 * The API key is inserted with a pre-computed SHA-256 hash so the seed can run
 * before the server starts (no live auth calls needed).
 */
import { createHash } from "node:crypto";
import { SourceType, PropertyType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  apikeyTable,
  collectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema } from "@contfu/svc-core";

/** Raw API key used to call POST /api/v1/consumer-collections in the test. Must be ≥ 64 chars. */
export const SNAPSHOT_ON_CONNECT_API_KEY =
  "snapshot_on_connect_e2e_test_api_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** Well-known 32-byte consumer key for the sync stream. */
export const SNAPSHOT_ON_CONNECT_CONSUMER_KEY = Buffer.from(
  "aa01020304050607080910111213141516171819202122232425262728293031",
  "hex",
);

/** Source collection ref used in the influx. */
export const SNAPSHOT_ON_CONNECT_COLLECTION_NAME = "snapshotOnConnectCollection";

const SOURCE_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
};

function hashApiKey(rawKey: string): string {
  const hash = createHash("sha256").update(rawKey).digest();
  return Buffer.from(hash).toString("base64url");
}

export async function seedSnapshotOnConnectData(db: any): Promise<void> {
  let [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) return;
  const userId = user.id;

  // Idempotent check
  const [existing] = await db
    .select({ id: consumerTable.id })
    .from(consumerTable)
    .where(eq(consumerTable.key, SNAPSHOT_ON_CONNECT_CONSUMER_KEY))
    .limit(1);

  if (existing) return;

  // Source pointing at the shared mock Strapi on port 4175
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: "00000006-0000-4000-a000-000000000001",
      name: "Mock Strapi (snapshot-on-connect)",
      type: SourceType.STRAPI,
      url: "http://localhost:4175",
      credentials: encCreds,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;

  // Source collection: articles
  const [sc] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Articles (snapshot-on-connect)",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!sc) return;

  // Target collection
  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: SNAPSHOT_ON_CONNECT_COLLECTION_NAME,
      displayName: "Snapshot On Connect Collection",
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;

  // Influx: articles → collection
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: sc.id,
    schema: pack(SOURCE_SCHEMA),
  });

  // Consumer (no consumer-collection — created via API in the test)
  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: SNAPSHOT_ON_CONNECT_CONSUMER_KEY,
      name: "Snapshot On Connect Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;

  // API key for creating the consumer-collection via POST /api/v1/consumer-collections
  const now = new Date();
  await db.insert(apikeyTable).values({
    userId,
    key: hashApiKey(SNAPSHOT_ON_CONNECT_API_KEY),
    start: SNAPSHOT_ON_CONNECT_API_KEY.slice(0, 6),
    enabled: true,
    rateLimitEnabled: false,
    requestCount: 0,
    permissions: JSON.stringify({ api: ["read", "write"] }),
    createdAt: now,
    updatedAt: now,
  });

  // Store consumer and collection IDs so the test can look them up by consumer key
  // (both will be needed for the POST body)
  // The test retrieves them via GET /api/v1/consumers and /api/v1/collections
}
