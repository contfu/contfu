/**
 * Mapping sync E2E test seed data.
 * Creates two Strapi source collections pointing at a mock Strapi server (port 4175),
 * each with different property names, both mapped to the same target collection schema.
 */
import { SourceType, PropertyType } from "@contfu/svc-core";
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
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

/** Well-known 32-byte consumer key — must match the test file. */
export const MAPPING_SYNC_CONSUMER_KEY = Buffer.from(
  "aa01020304050607080910111213141516171819202122232425262728293031",
  "hex",
);

export const COLLECTION_NAME = "mappingSyncCollection";

/** Target schema: both influxes merge into these target property names. */
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

/** Mappings for influx A: title→title, views→score (cast string). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "views", target: "score", cast: "string" },
];

/** Mappings for influx B: heading→title, rating→score (cast string). */
export const MAPPINGS_B: MappingRule[] = [
  { source: "heading", target: "title" },
  { source: "rating", target: "score", cast: "string" },
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

  // Idempotent check
  const [existing] = await db
    .select({ id: consumerTable.id })
    .from(consumerTable)
    .where(eq(consumerTable.key, MAPPING_SYNC_CONSUMER_KEY))
    .limit(1);

  if (existing) return;

  // Source pointing at mock Strapi on port 4175
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      name: "Mock Strapi (mapping-sync)",
      type: SourceType.STRAPI,
      url: "http://localhost:4175",
      credentials: encCreds,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;

  // Source collection A: api::article.article → /api/articles
  const [scA] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Articles",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scA) return;

  // Source collection B: api::post.post → /api/posts
  const [scB] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Posts",
      ref: Buffer.from("api::post.post", "utf-8"),
      schema: pack(SOURCE_SCHEMA_B),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scB) return;

  // Target collection
  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: COLLECTION_NAME,
      displayName: "Mapping Sync Collection",
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;

  // Influx A: articles → collection, with mappings
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scA.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Influx B: posts → collection, with mappings
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scB.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Consumer with well-known key
  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: MAPPING_SYNC_CONSUMER_KEY,
      name: "Mapping Sync Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;

  // Connection: consumer → collection
  await db.insert(connectionTable).values({
    userId,
    consumerId: consumer.id,
    collectionId: collection.id,
  });
}
