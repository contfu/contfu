import { Effect } from "effect";
import { and, eq, sql } from "drizzle-orm";
import type { BackendCollection } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, influxTable, consumerCollectionTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";
import type { CollectionSchema, RefTargets } from "@contfu/svc-core";

/**
 * Get a single Collection by ID.
 */
export const getCollection = (userId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(collectionTable)
          .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection) return null;

    // Get influx count
    const [influxCount] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(influxTable)
          .where(and(eq(influxTable.userId, userId), eq(influxTable.collectionId, collectionId))),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // Get connection count
    const [connectionCount] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(consumerCollectionTable)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              eq(consumerCollectionTable.collectionId, collectionId),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return {
      id: collection.id,
      userId: collection.userId,
      displayName: collection.displayName,
      name: collection.name,
      schema: unpack(collection.schema) as CollectionSchema,
      refTargets: collection.refTargets ? (unpack(collection.refTargets) as RefTargets) : undefined,
      includeRef: collection.includeRef,
      influxCount: influxCount?.count ?? 0,
      connectionCount: connectionCount?.count ?? 0,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    } satisfies BackendCollection;
  }).pipe(Effect.withSpan("collections.get", { attributes: { userId, collectionId } }));
