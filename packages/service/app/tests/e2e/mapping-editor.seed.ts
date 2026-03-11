/**
 * Mapping editor E2E test seed data.
 * Seeds a collection with two flows, each with a known source schema and mappings.
 */
import { ConnectionType, PropertyType } from "@contfu/svc-core";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { and, eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

/** Well-known UID for idempotent seeding. */
export const MAPPING_SOURCE_UID = "00000002-0000-4000-a000-000000000002";

/** Source schemas for the two flows. */
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

/** Initial mappings for flow A (identity). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "count", target: "count" },
  { source: "published", target: "published" },
  { source: "createdAt", target: "createdAt" },
];

/** Initial mappings for flow B (partial). */
export const MAPPINGS_B: MappingRule[] = [{ source: "title", target: "title" }];

export const COLLECTION_NAME = "mappingTestCollection";
export const COLLECTION_DISPLAY_NAME = "Mapping Test Collection";

/** Second collection for "add second flow" testing. */
export const COLLECTION2_NAME = "addInflowTestCollection";
export const COLLECTION2_DISPLAY_NAME = "Add Inflow Test Collection";

/** Source schema C — unlinked, used as a second flow source. */
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
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.uid, MAPPING_SOURCE_UID)))
    .limit(1);

  if (existing) return;

  // Source connection (Strapi)
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.STRAPI,
      name: "Test Mapping Connection",
      url: "https://strapi.test.local",
      uid: MAPPING_SOURCE_UID,
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection A
  const [srcColA] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Source A",
      displayName: "Source A",
      ref: Buffer.from("source-a", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: collectionTable.id });
  if (!srcColA) return;

  // Source collection B
  const [srcColB] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Source B",
      displayName: "Source B",
      ref: Buffer.from("source-b", "utf-8"),
      schema: pack(SOURCE_SCHEMA_B),
    })
    .returning({ id: collectionTable.id });
  if (!srcColB) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: COLLECTION_DISPLAY_NAME,
      name: COLLECTION_NAME,
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow A with schema + mappings
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColA.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Flow B with schema + partial mappings
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColB.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Source collection C (unlinked — for "add second flow" test)
  const [srcColC] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Source C",
      displayName: "Source C",
      ref: Buffer.from("source-c", "utf-8"),
      schema: pack(SOURCE_SCHEMA_C),
    })
    .returning({ id: collectionTable.id });
  if (!srcColC) return;

  // Second target collection with one flow (Source A)
  const [targetCollection2] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: COLLECTION2_DISPLAY_NAME,
      name: COLLECTION2_NAME,
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection2) return;

  await db.insert(flowTable).values({
    userId,
    sourceId: srcColA.id,
    targetId: targetCollection2.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });
}
