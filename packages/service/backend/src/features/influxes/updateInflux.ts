import { db } from "../../infra/db/db";
import { influxTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/svc-core";

export interface UpdateInfluxInput {
  id: number;
  filters?: Filter[] | null;
  schema?: CollectionSchema | null;
  includeRef?: boolean | null;
}

export interface UpdateInfluxResult {
  id: number;
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Update an influx's filters, schema, or includeRef setting.
 */
export async function updateInflux(
  userId: number,
  input: UpdateInfluxInput,
): Promise<UpdateInfluxResult | null> {
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.filters !== undefined) {
    updates.filters = input.filters?.length ? pack(input.filters) : null;
  }

  if (input.schema !== undefined) {
    updates.schema = input.schema ? pack(input.schema) : null;
  }

  if (input.includeRef !== undefined) {
    updates.includeRef = input.includeRef;
  }

  const [updated] = await db
    .update(influxTable)
    .set(updates)
    .where(and(eq(influxTable.userId, userId), eq(influxTable.id, input.id)))
    .returning();

  if (!updated) return null;

  return {
    id: updated.id,
    userId: updated.userId,
    collectionId: updated.collectionId,
    sourceCollectionId: updated.sourceCollectionId,
    schema: updated.schema ? (unpack(updated.schema) as CollectionSchema) : null,
    filters: updated.filters ? (unpack(updated.filters) as Filter[]) : null,
    includeRef: updated.includeRef,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}
