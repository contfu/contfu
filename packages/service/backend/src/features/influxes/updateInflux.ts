import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { influxTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import type { CollectionSchema, Filter, MappingRule } from "@contfu/svc-core";

export interface UpdateInfluxInput {
  id: number;
  filters?: Filter[] | null;
  mappings?: MappingRule[] | null;
  schema?: CollectionSchema | null;
  includeRef?: boolean;
}

export interface UpdateInfluxResult {
  id: number;
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  schema: CollectionSchema | null;
  mappings: MappingRule[] | null;
  filters: Filter[] | null;
  includeRef: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Update an influx's filters, schema, or includeRef setting.
 */
export const updateInflux = (userId: number, input: UpdateInfluxInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.filters !== undefined) {
      updates.filters = input.filters?.length ? pack(input.filters) : null;
    }

    if (input.mappings !== undefined) {
      updates.mappings = input.mappings?.length ? pack(input.mappings) : null;
    }

    if (input.schema !== undefined) {
      updates.schema = input.schema ? pack(input.schema) : null;
    }

    if (input.includeRef !== undefined) {
      updates.includeRef = input.includeRef;
    }

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(influxTable)
          .set(updates)
          .where(and(eq(influxTable.userId, userId), eq(influxTable.id, input.id)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return null;

    return {
      id: updated.id,
      userId: updated.userId,
      collectionId: updated.collectionId,
      sourceCollectionId: updated.sourceCollectionId,
      schema: updated.schema ? (unpack(updated.schema) as CollectionSchema) : null,
      mappings: updated.mappings ? (unpack(updated.mappings) as MappingRule[]) : null,
      filters: updated.filters ? (unpack(updated.filters) as Filter[]) : null,
      includeRef: updated.includeRef,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    } satisfies UpdateInfluxResult;
  }).pipe(Effect.withSpan("influxes.update", { attributes: { userId, influxId: input.id } }));
