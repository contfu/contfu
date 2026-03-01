/**
 * Mapping editor E2E test seed data.
 * Seeds a collection with two influxes, each with a known source schema and mappings.
 */
import { SourceType, PropertyType } from "@contfu/svc-core";
import {
  collectionTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { and, eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

/** Well-known UID for idempotent seeding. */
export const MAPPING_SOURCE_UID = "00000002-0000-4000-a000-000000000002";

/** Source schemas for the two influxes. */
export const SOURCE_SCHEMA_A: CollectionSchema = {
  title: PropertyType.STRING,
  count: PropertyType.NUMBER,
  published: PropertyType.BOOLEAN,
  createdAt: PropertyType.DATE,
};

export const SOURCE_SCHEMA_B: CollectionSchema = {
  title: PropertyType.STRING,
  body: PropertyType.STRING,
  rating: PropertyType.NUMBER,
};

/** Target schema (union of source types where applicable). */
export const TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  count: PropertyType.NUMBER,
  published: PropertyType.BOOLEAN,
  createdAt: PropertyType.DATE,
};

/** Initial mappings for influx A (identity). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "count", target: "count" },
  { source: "published", target: "published" },
  { source: "createdAt", target: "createdAt" },
];

/** Initial mappings for influx B (partial). */
export const MAPPINGS_B: MappingRule[] = [{ source: "title", target: "title" }];

export const COLLECTION_NAME = "mappingTestCollection";
export const COLLECTION_DISPLAY_NAME = "Mapping Test Collection";

/** Second collection for "add second influx" testing. */
export const COLLECTION2_NAME = "addInfluxTestCollection";
export const COLLECTION2_DISPLAY_NAME = "Add Influx Test Collection";

/** Source schema C — unlinked, used as a second influx. */
export const SOURCE_SCHEMA_C: CollectionSchema = {
  title: PropertyType.STRING,
  summary: PropertyType.STRING,
  views: PropertyType.NUMBER,
};

export async function seedMappingEditorData(db: any): Promise<void> {
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
    .select({ id: sourceTable.id })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.uid, MAPPING_SOURCE_UID)))
    .limit(1);

  if (existing) return;

  // Source (Strapi type — no external API calls needed)
  const [source] = await db
    .insert(sourceTable)
    .values({
      userId,
      uid: MAPPING_SOURCE_UID,
      name: "Test Mapping Source",
      type: SourceType.STRAPI,
      url: "https://strapi.test.local",
    })
    .returning({ id: sourceTable.id });
  if (!source) return;

  // Source collection A
  const [scA] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Source A",
      ref: Buffer.from("source-a", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scA) return;

  // Source collection B
  const [scB] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Source B",
      ref: Buffer.from("source-b", "utf-8"),
      schema: pack(SOURCE_SCHEMA_B),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scB) return;

  // Target collection
  const [collection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: COLLECTION_DISPLAY_NAME,
      name: COLLECTION_NAME,
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!collection) return;

  // Influx A with schema + mappings
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scA.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Influx B with schema + partial mappings
  await db.insert(influxTable).values({
    userId,
    collectionId: collection.id,
    sourceCollectionId: scB.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Source collection C (unlinked — for "add second influx" test)
  const [scC] = await db
    .insert(sourceCollectionTable)
    .values({
      userId,
      sourceId: source.id,
      name: "Source C",
      ref: Buffer.from("source-c", "utf-8"),
      schema: pack(SOURCE_SCHEMA_C),
    })
    .returning({ id: sourceCollectionTable.id });
  if (!scC) return;

  // Second collection with one influx (Source A)
  const [collection2] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: COLLECTION2_DISPLAY_NAME,
      name: COLLECTION2_NAME,
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: collectionTable.id });
  if (!collection2) return;

  await db.insert(influxTable).values({
    userId,
    collectionId: collection2.id,
    sourceCollectionId: scA.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });
}
