import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, flowTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";
import { applyMappingsToSchema } from "../../domain/mapping-ops";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

/**
 * Return the effective schema for each inflow targeting a collection,
 * with mappings applied. Unlike computeCollectionSchema, these are NOT merged —
 * one entry per inflow is returned, enabling union type generation.
 *
 * Returns an empty array if no flows target the collection.
 */
export const listInflowSchemas = (userId: number, collectionId: number) =>
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

    const schemas: CollectionSchema[] = [];
    for (const row of rows) {
      const schemaBuf = row.sourceCollectionSchema ?? row.flowSchema;
      if (!schemaBuf) continue;
      const rawSchema = unpack(schemaBuf) as CollectionSchema;
      const schema = row.mappings
        ? applyMappingsToSchema(rawSchema, unpack(row.mappings) as MappingRule[])
        : rawSchema;
      schemas.push(schema);
    }

    return schemas;
  }).pipe(Effect.withSpan("collections.listInflowSchemas", { attributes: { collectionId } }));
