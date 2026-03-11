import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";
import type { CollectionSchema } from "@contfu/svc-core";

/**
 * Get the schema from a collection (unpacked from msgpack).
 * Returns null if the collection does not exist.
 */
export const getCollectionSchema = (collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ schema: collectionTable.schema })
          .from(collectionTable)
          .where(eq(collectionTable.id, collectionId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return null;

    return row.schema ? (unpack(row.schema) as CollectionSchema) : ({} as CollectionSchema);
  }).pipe(Effect.withSpan("collections.getSchema", { attributes: { collectionId } }));
