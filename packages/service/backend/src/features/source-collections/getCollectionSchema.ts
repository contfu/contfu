import { decode } from "@msgpack/msgpack";
import type { CollectionSchema } from "@contfu/svc-core";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { sourceCollectionTable } from "../../infra/db/schema";

/**
 * Get the schema for a source collection.
 * Returns null if the collection doesn't exist or has no schema.
 */
export const getCollectionSchema = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ schema: sourceCollectionTable.schema })
          .from(sourceCollectionTable)
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection?.schema) return null;

    try {
      return decode(collection.schema) as CollectionSchema;
    } catch {
      return null;
    }
  }).pipe(Effect.withSpan("sourceCollections.getSchema", { attributes: { userId } }));
