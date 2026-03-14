import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError, ValidationError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";
import { toCamelCase, type CollectionSchema, type RefTargets } from "@contfu/svc-core";
import { pack } from "msgpackr";
import type { CollectionIcon } from "@contfu/core";

export interface UpdateCollectionInput {
  displayName?: string;
  name?: string;
  includeRef?: boolean;
  schema?: CollectionSchema;
  refTargets?: RefTargets | null;
  icon?: CollectionIcon | null;
}

const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/;

function getReservedSchemaProperty(schema?: CollectionSchema): string | null {
  if (!schema) return null;
  return Object.keys(schema).find((key) => key.startsWith("$")) ?? null;
}

/**
 * Update a Collection.
 */
export const updateCollection = (collectionId: number, input: UpdateCollectionInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    let name = input.name;
    if (name === undefined && input.displayName !== undefined) {
      name = toCamelCase(input.displayName);
    }

    if (name !== undefined && !camelCasePattern.test(name)) {
      yield* Effect.fail(
        new ValidationError({
          field: "name",
          message: `Collection name "${name}" must be a camelCase identifier (e.g. "blogPosts")`,
        }),
      );
    }

    const reservedProperty = getReservedSchemaProperty(input.schema);
    if (reservedProperty) {
      yield* Effect.fail(
        new ValidationError({
          field: "schema",
          message: `Collection property "${reservedProperty}" is invalid because names starting with "$" are reserved for system fields`,
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
            refTargets:
              input.refTargets === null
                ? null
                : input.refTargets
                  ? pack(input.refTargets)
                  : undefined,
            includeRef: input.includeRef,
            icon: input.icon === null ? null : input.icon ? pack(input.icon) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(collectionTable.id, collectionId))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("collections.update", { attributes: { collectionId } }));
