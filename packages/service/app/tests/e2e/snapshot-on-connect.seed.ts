/**
 * Snapshot-on-connect E2E test seed data.
 *
 * Creates a client connection + consumer collection, a source connection + source collection,
 * a target collection, and a flow (source→target) — but deliberately does NOT create
 * the flow (target→consumer). The test creates it via the API to exercise the
 * snapshot-on-connect feature.
 *
 * The API key is inserted with a pre-computed SHA-256 hash so the seed can run
 * before the server starts (no live auth calls needed).
 */
import { createHash } from "node:crypto";
import { ConnectionType, PropertyType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { hashKeyForStorage } from "./seed-utils";
import {
  apikeyTable,
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema } from "@contfu/svc-core";

/** Raw API key used to call POST /api/v1/flows in the test. Must be >= 64 chars. */
export const SNAPSHOT_ON_CONNECT_API_KEY =
  "snapshot_on_connect_e2e_test_api_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** Well-known consumer key for the sync stream. */
export const SNAPSHOT_ON_CONNECT_CONSUMER_KEY = Buffer.from(
  "00000000000000000000000000000006",
  "hex",
);

/** Well-known consumer name for the sync stream. */
export const SNAPSHOT_ON_CONNECT_CONSUMER_NAME = "Snapshot On Connect Consumer";

/** Source collection ref used in the flow. */
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

  // Idempotent check — look for client connection by name
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(eq(connectionTable.name, "Snapshot On Connect Client"))
    .limit(1);

  if (existing) return;

  // Source connection (Strapi)
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.STRAPI,
      name: "Mock Strapi Connection (snapshot-on-connect)",
      credentials: encCreds,
      url: "http://localhost:4175",
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection: articles
  const [sourceCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Articles (snapshot-on-connect)",
      displayName: "Articles (snapshot-on-connect)",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!sourceCollection) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: SNAPSHOT_ON_CONNECT_COLLECTION_NAME,
      displayName: "Snapshot On Connect Collection",
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow: source collection → target collection
  await db.insert(flowTable).values({
    userId,
    sourceId: sourceCollection.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA),
  });

  // Client connection (replaces consumer)
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.APP,
      name: "Snapshot On Connect Client",
      credentials: hashKeyForStorage(SNAPSHOT_ON_CONNECT_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection — no flow to target; created via API in the test.
  await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: SNAPSHOT_ON_CONNECT_CONSUMER_NAME,
      displayName: "Snapshot On Connect Consumer",
    })
    .returning({ id: collectionTable.id });

  // API key for creating the flow via the API
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
}
