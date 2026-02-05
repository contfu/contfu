import { db } from "../../infra/db/db";
import { sourceCollectionTable, influxTable } from "../../infra/db/schema";
import { and, eq, max } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/core";

export interface AddInfluxInput {
  /** Target collection ID */
  collectionId: number;
  /** Source ID */
  sourceId: number;
  /** External reference (Notion DB ID, Strapi content type, Web path) */
  ref: string;
  /** Display name for the source collection */
  name: string;
  /** If provided, use this existing source collection instead of creating one */
  existingSourceCollectionId?: number;
  /** Optional filters for the influx */
  filters?: Filter[];
  /** Optional schema (if known from probe results) */
  schema?: CollectionSchema;
}

export interface AddInfluxResult {
  success: true;
  sourceCollectionId: number;
  influxId: number;
}

export interface AddInfluxError {
  success: false;
  error: string;
}

/**
 * Add an influx to a collection, auto-creating the SourceCollection if needed.
 * This is the main entry point for the "Add Influx" dialog.
 */
export async function addInfluxWithSourceCollection(
  userId: number,
  input: AddInfluxInput,
): Promise<AddInfluxResult | AddInfluxError> {
  let sourceCollectionId: number;

  if (input.existingSourceCollectionId) {
    // Verify the source collection exists and belongs to this user
    const [existing] = await db
      .select({ id: sourceCollectionTable.id })
      .from(sourceCollectionTable)
      .where(
        and(
          eq(sourceCollectionTable.userId, userId),
          eq(sourceCollectionTable.id, input.existingSourceCollectionId),
        ),
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "Source collection not found" };
    }
    sourceCollectionId = existing.id;
  } else {
    // Create new source collection
    const [maxScResult] = await db
      .select({ maxId: max(sourceCollectionTable.id) })
      .from(sourceCollectionTable)
      .where(eq(sourceCollectionTable.userId, userId));

    const nextScId = (maxScResult?.maxId ?? 0) + 1;

    const [newSourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        id: nextScId,
        userId,
        sourceId: input.sourceId,
        name: input.name,
        ref: Buffer.from(input.ref, "utf-8"),
        schema: input.schema ? pack(input.schema) : null,
      })
      .returning();

    sourceCollectionId = newSourceCollection.id;
  }

  // Check if influx already exists
  const [existingInflux] = await db
    .select({ id: influxTable.id })
    .from(influxTable)
    .where(
      and(
        eq(influxTable.userId, userId),
        eq(influxTable.collectionId, input.collectionId),
        eq(influxTable.sourceCollectionId, sourceCollectionId),
      ),
    )
    .limit(1);

  if (existingInflux) {
    return { success: false, error: "This data source is already linked to this collection" };
  }

  // Get schema from source collection if not provided
  let schema = input.schema;
  if (!schema && input.existingSourceCollectionId) {
    const [sc] = await db
      .select({ schema: sourceCollectionTable.schema })
      .from(sourceCollectionTable)
      .where(
        and(
          eq(sourceCollectionTable.userId, userId),
          eq(sourceCollectionTable.id, sourceCollectionId),
        ),
      )
      .limit(1);

    if (sc?.schema) {
      schema = unpack(sc.schema) as CollectionSchema;
    }
  }

  // Create the influx
  const [maxInfluxResult] = await db
    .select({ maxId: max(influxTable.id) })
    .from(influxTable)
    .where(eq(influxTable.userId, userId));

  const nextInfluxId = (maxInfluxResult?.maxId ?? 0) + 1;

  const [influx] = await db
    .insert(influxTable)
    .values({
      id: nextInfluxId,
      userId,
      collectionId: input.collectionId,
      sourceCollectionId,
      schema: schema ? pack(schema) : null,
      filters: input.filters?.length ? pack(input.filters) : null,
    })
    .returning();

  return {
    success: true,
    sourceCollectionId,
    influxId: influx.id,
  };
}
