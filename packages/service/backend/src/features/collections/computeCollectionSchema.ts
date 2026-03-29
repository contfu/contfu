import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, flowTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";
import { applyMappingsToSchema } from "../../domain/mapping-ops";
import { mergeSchemaValues, type CollectionSchema, type MappingRule } from "@contfu/svc-core";

/**
 * Compute the effective schema for a target collection by merging all source
 * flow schemas (with mappings applied). This is the same logic used by
 * broadcastSchemaChanges and the sync SSE endpoint — it reflects what data
 * consumers actually receive, including enum values derived from source schemas.
 *
 * Returns an empty schema if no flows target the collection.
 */
export const computeCollectionSchema = (userId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            flowSchema: flowTable.schema,
            sourceCollectionSchema: collectionTable.schema,
            mappings: flowTable.mappings,
          })
          .from(flowTable)
          .innerJoin(collectionTable, eq(flowTable.sourceId, collectionTable.id))
          .where(and(eq(flowTable.userId, userId), eq(flowTable.targetId, collectionId))),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const merged: CollectionSchema = {};
    for (const row of rows) {
      const schemaBuf = row.sourceCollectionSchema ?? row.flowSchema;
      if (!schemaBuf) continue;
      const rawSchema = unpack(schemaBuf) as CollectionSchema;
      const schema = row.mappings
        ? applyMappingsToSchema(rawSchema, unpack(row.mappings) as MappingRule[])
        : rawSchema;
      for (const [prop, value] of Object.entries(schema)) {
        merged[prop] = mergeSchemaValues(merged[prop] ?? 0, value);
      }
    }

    return merged;
  }).pipe(Effect.withSpan("collections.computeSchema", { attributes: { collectionId } }));
