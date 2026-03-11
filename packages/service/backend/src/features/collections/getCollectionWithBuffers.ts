import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { Collection } from "../../infra/db/schema";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";

/**
 * Get a raw Collection by ID with buffer fields intact.
 * Used internally by sync workers that need raw bytea data.
 */
export const getCollectionWithBuffers = (collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db.select().from(collectionTable).where(eq(collectionTable.id, collectionId)).limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return (collection as Collection) ?? null;
  }).pipe(Effect.withSpan("collections.getWithBuffers", { attributes: { collectionId } }));
