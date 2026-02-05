import { db } from "../../infra/db/db";
import { influxTable, sourceCollectionTable } from "../../infra/db/schema";
import { and, eq, max } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/core";

export interface CreateInfluxInput {
  collectionId: number;
  sourceCollectionId: number;
  filters?: Filter[];
  schema?: CollectionSchema;
}

export interface InfluxResult {
  id: number;
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean | null;
  createdAt: number;
  updatedAt: number | null;
}

/**
 * Create an influx linking a source collection to a collection.
 * If schema is not provided, it will be fetched from the source collection.
 */
export async function createInflux(
  userId: number,
  input: CreateInfluxInput,
): Promise<InfluxResult> {
  // If no schema provided, fetch from source collection
  let schema = input.schema;
  if (!schema) {
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

    if (sourceCollection?.schema) {
      schema = unpack(sourceCollection.schema) as CollectionSchema;
    }
  }

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

  return {
    id: inserted.id,
    userId: inserted.userId,
    collectionId: inserted.collectionId,
    sourceCollectionId: inserted.sourceCollectionId,
    schema: inserted.schema ? (unpack(inserted.schema) as CollectionSchema) : null,
    filters: inserted.filters ? (unpack(inserted.filters) as Filter[]) : null,
    includeRef: inserted.includeRef,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}
