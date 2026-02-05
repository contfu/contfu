import { db } from "../../infra/db/db";
import { influxTable, sourceCollectionTable, type Influx } from "../../infra/db/schema";
import { and, eq, max } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/core";

export interface AddSourceCollectionMappingInput {
  collectionId: number;
  sourceCollectionId: number;
  filters?: Filter[];
}

export interface CollectionMappingResult {
  id: number;
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  filters: Filter[] | null;
  createdAt: number;
}

function mapToResult(influx: Influx): CollectionMappingResult {
  return {
    id: influx.id,
    userId: influx.userId,
    collectionId: influx.collectionId,
    sourceCollectionId: influx.sourceCollectionId,
    filters: influx.filters ? (unpack(influx.filters) as Filter[]) : null,
    createdAt: influx.createdAt,
  };
}

/**
 * Add a source collection to an aggregation collection with optional filters.
 * @deprecated Use createInflux from features/influxes instead
 */
export async function addSourceCollectionMapping(
  userId: number,
  input: AddSourceCollectionMappingInput,
): Promise<CollectionMappingResult> {
  // Fetch schema from source collection
  const [sourceCollection] = await db
    .select({ schema: sourceCollectionTable.schema })
    .from(sourceCollectionTable)
    .where(
      and(
        eq(sourceCollectionTable.userId, userId),
        eq(sourceCollectionTable.id, input.sourceCollectionId),
      ),
    )
    .limit(1);

  const schema = sourceCollection?.schema
    ? (unpack(sourceCollection.schema) as CollectionSchema)
    : null;

  // Get next ID for this user
  const [maxIdResult] = await db
    .select({ maxId: max(influxTable.id) })
    .from(influxTable)
    .where(eq(influxTable.userId, userId));

  const nextId = (maxIdResult?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(influxTable)
    .values({
      id: nextId,
      userId,
      collectionId: input.collectionId,
      sourceCollectionId: input.sourceCollectionId,
      schema: schema ? pack(schema) : null,
      filters: input.filters?.length ? pack(input.filters) : null,
    })
    .returning();

  return mapToResult(inserted);
}
