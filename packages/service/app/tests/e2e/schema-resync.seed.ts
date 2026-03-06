/**
 * Schema resync E2E test seed data.
 * Creates a collection with an influx and a consumer connected to it,
 * so schema-update broadcasts and resync enqueuing can be verified.
 */
import { SourceType, PropertyType } from "@contfu/svc-core";
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

/** Well-known 32-byte consumer key for schema-resync tests. */
export const SCHEMA_RESYNC_CONSUMER_KEY = Buffer.from(
  "cc01020304050607080910111213141516171819202122232425262728293031",
  "hex",
);

export const SCHEMA_RESYNC_COLLECTION_NAME = "schemaResyncCollection";

/** Initial target schema. */
export const INITIAL_TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
};

/** Updated target schema — used in the test to trigger a resync. */
export const UPDATED_TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  body: PropertyType.STRING,
};

/** Source schema. */
export const SOURCE_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  body: PropertyType.STRING,
};

/** Mappings for the influx. */
export const MAPPINGS: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "body", target: "body" },
];

export async function seedSchemaResyncData(db: any): Promise<void> {
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
    .where(eq(consumerTable.key, SCHEMA_RESYNC_CONSUMER_KEY))
    .limit(1);

  if (existing) return;

  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: "00000004-0000-4000-a000-000000000001",
      name: "Schema Resync Source",
      type: SourceType.STRAPI,
    })
    .returning({ id: sourceTable.id });
  if (!source) return;

  const [sourceCollection] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Schema Resync Source Collection",
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!sourceCollection) return;

  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: SCHEMA_RESYNC_COLLECTION_NAME,
      displayName: "Schema Resync Collection",
      schema: pack(INITIAL_TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;

  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: sourceCollection.id,
    schema: pack(SOURCE_SCHEMA),
    mappings: pack(MAPPINGS),
  });

  const [consumer] = await db
    .insert(consumerTable)
    .values({
      userId,
      key: SCHEMA_RESYNC_CONSUMER_KEY,
      name: "Schema Resync Consumer",
    })
    .returning({ id: consumerTable.id });
  if (!consumer) return;

  await db.insert(consumerCollectionTable).values({
    userId,
    consumerId: consumer.id,
    collectionId: collection.id,
  });
}
