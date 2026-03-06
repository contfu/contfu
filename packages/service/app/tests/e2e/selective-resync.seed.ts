/**
 * Selective influx resync E2E test seed data.
 *
 * Creates a collection with TWO influxes from different mock-Strapi source
 * collections (articles + posts), a consumer, and a connection.
 * The test changes mappings on only one influx and verifies that a resync
 * is triggered (items arrive with the new mapping applied).
 */
import { SourceType, PropertyType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

/** Well-known 32-byte consumer key. */
export const SELECTIVE_RESYNC_CONSUMER_KEY = Buffer.from(
  "dd01020304050607080910111213141516171819202122232425262728293031",
  "hex",
);

export const COLLECTION_NAME = "selectiveResyncCollection";

/** Target schema. */
export const TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  score: PropertyType.STRING,
};

/** Source A schema (articles): title + views. */
export const SOURCE_SCHEMA_A: CollectionSchema = {
  title: PropertyType.STRING,
  views: PropertyType.NUMBER,
};

/** Source B schema (posts): heading + rating. */
export const SOURCE_SCHEMA_B: CollectionSchema = {
  heading: PropertyType.STRING,
  rating: PropertyType.NUMBER,
};

/** Mappings for influx A: title->title, views->score (cast string). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "views", target: "score", cast: "string" },
];

/** Mappings for influx B: heading->title, rating->score (cast string). */
export const MAPPINGS_B: MappingRule[] = [
  { source: "heading", target: "title" },
  { source: "rating", target: "score", cast: "string" },
];

export async function seedSelectiveResyncData(db: any): Promise<void> {
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
    .where(eq(consumerTable.key, SELECTIVE_RESYNC_CONSUMER_KEY))
    .limit(1);

  if (existing) return;

  // Source pointing at mock Strapi on port 4175
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: "00000005-0000-4000-a000-000000000001",
      name: "Mock Strapi (selective-resync)",
      type: SourceType.STRAPI,
      url: "http://localhost:4175",
      credentials: encCreds,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;

  // Source collection A: articles
  const [scA] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Articles (selective)",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scA) return;

  // Source collection B: posts
  const [scB] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Posts (selective)",
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
      displayName: "Selective Resync Collection",
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;

  // Influx A: articles -> collection
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scA.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Influx B: posts -> collection
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scB.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Consumer
  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: SELECTIVE_RESYNC_CONSUMER_KEY,
      name: "Selective Resync Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;

  // Connection
  await db.insert(consumerCollectionTable).values({
    userId,
    consumerId: consumer.id,
    collectionId: collection.id,
  });
}
