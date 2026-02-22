import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { BackendSourceCollection } from "../../domain/types";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { sourceCollectionTable, type SourceCollection } from "../../infra/db/schema";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendSourceCollection(collection: SourceCollection): BackendSourceCollection {
  return {
    id: collection.id,
    userId: collection.userId,
    sourceId: collection.sourceId,
    name: collection.name,
    hasRef: collection.ref !== null,
    refString: collection.ref ? collection.ref.toString("utf-8") : null,
    itemCount: countItemIds(collection.itemIds),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

/**
 * Get a single collection by ID.
 */
export const getCollection = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceCollectionTable)
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection) return undefined;

    return mapToBackendSourceCollection(collection);
  }).pipe(Effect.withSpan("sourceCollections.get", { attributes: { userId } }));
