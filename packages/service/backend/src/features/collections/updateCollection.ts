import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";
import { toCamelCase, type CollectionSchema } from "@contfu/svc-core";
import { pack } from "msgpackr";

export interface UpdateCollectionInput {
  displayName?: string;
  name?: string;
  includeRef?: boolean;
  schema?: CollectionSchema;
}

const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/;

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

    let name = input.name;
    if (name === undefined && input.displayName !== undefined) {
      name = toCamelCase(input.displayName);
    }

    if (name !== undefined && !camelCasePattern.test(name)) {
      yield* Effect.fail(
        new DatabaseError({
          cause: new Error(
            `Collection name "${name}" must be a camelCase identifier (e.g. "blogPosts")`,
          ),
        }),
      );
    }

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(collectionTable)
          .set({
            displayName: input.displayName,
            name,
            schema: input.schema ? pack(input.schema) : undefined,
            includeRef: input.includeRef,
            updatedAt: new Date(),
          })
          .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("collections.update", { attributes: { userId, collectionId } }));
