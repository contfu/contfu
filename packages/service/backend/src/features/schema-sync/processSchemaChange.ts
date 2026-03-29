import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import { IncidentType, type CollectionSchema, type Filter } from "@contfu/svc-core";
import { findInvalidFilters } from "../../domain/filter-matching";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, flowTable } from "../../infra/db/schema";
import { createIncident } from "../incidents/createIncident";
import { autoResolveIncidentsForFlow } from "../incidents/autoResolveIncidentsForFlow";

/**
 * Process a schema change for a collection:
 * 1. Read the old schema
 * 2. Update the collection's schema
 * 3. Validate all flow filters against the new schema
 * 4. Create SchemaIncompatible incidents for broken filters, or auto-resolve stale ones
 *
 * Must be called within a user RLS context (withUserContext).
 */
export const processSchemaChange = (
  userId: number,
  collectionId: number,
  newSchema: CollectionSchema,
  /** Stable Notion property ID → internal camelCase name; persisted for rename detection. */
  notionPropertyIds?: Record<string, string>,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    // 1. Read old schema
    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ schema: collectionTable.schema })
          .from(collectionTable)
          .where(eq(collectionTable.id, collectionId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection) return;

    const oldSchema: CollectionSchema = collection.schema ? unpack(collection.schema) : {};

    // 2. Update schema (and notionPropertyIds when provided)
    const schemaBuf = Buffer.from(pack(newSchema));
    const setValues: Record<string, unknown> = { schema: schemaBuf };
    if (notionPropertyIds !== undefined) {
      setValues.notionPropertyIds = Buffer.from(pack(notionPropertyIds));
    }
    yield* Effect.tryPromise({
      try: () =>
        db.update(collectionTable).set(setValues).where(eq(collectionTable.id, collectionId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // 3. Find all flows where sourceId = collectionId
    const flows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: flowTable.id,
            filters: flowTable.filters,
          })
          .from(flowTable)
          .where(eq(flowTable.sourceId, collectionId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // 4. Validate filters for each flow
    for (const flow of flows) {
      const filters: Filter[] = flow.filters ? unpack(flow.filters) : [];

      if (filters.length === 0) {
        yield* autoResolveIncidentsForFlow(userId, flow.id);
        continue;
      }

      const invalidFilters = findInvalidFilters(filters, newSchema);

      if (invalidFilters.length > 0) {
        yield* createIncident(userId, {
          flowId: flow.id,
          type: IncidentType.SchemaIncompatible,
          message: `Schema change broke ${invalidFilters.length} filter(s): ${invalidFilters.map((f: Filter) => f.property).join(", ")}`,
          details: { oldSchema, newSchema, invalidFilters },
        });
      } else {
        yield* autoResolveIncidentsForFlow(userId, flow.id);
      }
    }
  }).pipe(
    Effect.withSpan("schemaSync.processSchemaChange", {
      attributes: { userId, collectionId },
    }),
  );
