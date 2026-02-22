import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";

export interface UpdateCollectionInput {
  name?: string;
  includeRef?: boolean;
}

/**
 * Update a Collection.
 */
export const updateCollection = (
  userId: number,
  collectionId: number,
  input: UpdateCollectionInput,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(collectionTable)
          .set({
            name: input.name,
            includeRef: input.includeRef,
            updatedAt: new Date(),
          })
          .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("collections.update", { attributes: { userId, collectionId } }));
