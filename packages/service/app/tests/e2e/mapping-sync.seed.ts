/**
 * Mapping sync E2E test seed data.
 * Creates two source collections pointing at a mock Strapi server (port 4175),
 * each with different property names, both mapped to the same target collection schema.
 */
import { ConnectionType, PropertyType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";
import { hashKeyForStorage } from "./seed-utils";

/** Well-known consumer key for mapping-sync tests. */
export const MAPPING_SYNC_CONSUMER_KEY = Buffer.from("00000000000000000000000000000002", "hex");

/** Well-known consumer key for validation tests. */
export const VALIDATION_CONSUMER_KEY = Buffer.from("00000000000000000000000000000003", "hex");

/** Well-known consumer name — must match the test file. */
export const MAPPING_SYNC_CONSUMER_NAME = "Mapping Sync Consumer";

/** Separate consumer name for validation tests. */
export const VALIDATION_CONSUMER_NAME = "Validation Sync Consumer";

export const COLLECTION_NAME = "mappingSyncCollection";
export const VALIDATION_COLLECTION_NAME = "validationSyncCollection";

/** Target schema: both flows merge into these target property names. */
export const TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  score: PropertyType.STRING,
};

/** Source A schema (articles): title + views (number). */
export const SOURCE_SCHEMA_A: CollectionSchema = {
  title: PropertyType.STRING,
  views: PropertyType.NUMBER,
};

/** Source B schema (posts): heading + rating (number). */
export const SOURCE_SCHEMA_B: CollectionSchema = {
  heading: PropertyType.STRING,
  rating: PropertyType.NUMBER,
};

/** Mappings for flow A: title→title, views→score (cast string). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "views", target: "score", cast: "string" },
];

/** Mappings for flow B: heading→title, rating→score (cast string). */
export const MAPPINGS_B: MappingRule[] = [
  { source: "heading", target: "title" },
  { source: "rating", target: "score", cast: "string" },
];

/** Validation test: target schema with number type for views. */
export const VALIDATION_TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  views: PropertyType.NUMBER,
};

/** Validation test: mappings with number cast — "not-a-number" will fail. */
export const VALIDATION_MAPPINGS: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "views", target: "views", cast: "number" },
];

export async function seedMappingSyncData(db: any): Promise<void> {
  // Get test user
  let [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) return;
  const userId = user.id;

  // Idempotent check — look for consumer connection by name
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(eq(connectionTable.name, "Mapping Sync Client"))
    .limit(1);

  if (existing) return;

  // Source connection (Strapi)
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.STRAPI,
      name: "Mock Strapi Connection (mapping-sync)",
      credentials: encCreds,
      url: "http://localhost:4175",
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection A: api::article.article → /api/articles
  const [srcColA] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Articles",
      displayName: "Articles",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: collectionTable.id });
  if (!srcColA) return;

  // Source collection B: api::post.post → /api/posts
  const [srcColB] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Posts",
      displayName: "Posts",
      ref: Buffer.from("api::post.post", "utf-8"),
      schema: pack(SOURCE_SCHEMA_B),
    })
    .returning({ id: collectionTable.id });
  if (!srcColB) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: COLLECTION_NAME,
      displayName: "Mapping Sync Collection",
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow A: articles → target collection, with mappings
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColA.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Flow B: posts → target collection, with mappings
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColB.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Client connection for consumer
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.CLIENT,
      name: "Mapping Sync Client",
      credentials: hashKeyForStorage(MAPPING_SYNC_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection — name matches target for sync stream events,
  // but displayName differs to avoid duplicate links on the collections page.
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: COLLECTION_NAME,
      displayName: "Mapping Sync Client",
    })
    .returning({ id: collectionTable.id });
  if (!consumerCollection) return;

  // Flow: target → consumer collection (replaces outflow)
  await db.insert(flowTable).values({
    userId,
    sourceId: targetCollection.id,
    targetId: consumerCollection.id,
  });

  // ---- Validation test data ----

  // Target collection with number-typed views
  const [valTargetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: VALIDATION_COLLECTION_NAME,
      displayName: "Validation Sync Collection",
      schema: pack(VALIDATION_TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!valTargetCollection) return;

  // Flow: articles → validation target collection, with number cast on views
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColA.id,
    targetId: valTargetCollection.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(VALIDATION_MAPPINGS),
  });

  // Client connection for validation consumer
  const [valClientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.CLIENT,
      name: "Validation Sync Client",
      credentials: hashKeyForStorage(VALIDATION_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!valClientConnection) return;

  // Validation consumer collection — name matches target for sync stream events.
  const [valConsumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: valClientConnection.id,
      name: VALIDATION_COLLECTION_NAME,
      displayName: "Validation Sync Client",
    })
    .returning({ id: collectionTable.id });
  if (!valConsumerCollection) return;

  // Flow: validation target → validation consumer collection
  await db.insert(flowTable).values({
    userId,
    sourceId: valTargetCollection.id,
    targetId: valConsumerCollection.id,
  });
}
