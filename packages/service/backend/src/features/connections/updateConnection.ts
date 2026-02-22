import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { connectionTable, type Connection } from "../../infra/db/schema";
import type { BackendConnection, UpdateConnectionInput } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

function mapToBackendConnection(connection: Connection): BackendConnection {
  return {
    userId: connection.userId,
    consumerId: connection.consumerId,
    collectionId: connection.collectionId,
    includeRef: connection.includeRef,
    lastItemChanged: connection.lastItemChanged,
    lastConsistencyCheck: connection.lastConsistencyCheck,
  };
}

/**
 * Update a connection.
 */
export const updateConnection = (
  userId: number,
  consumerId: number,
  collectionId: number,
  input: UpdateConnectionInput,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(connectionTable)
          .set(input)
          .where(
            and(
              eq(connectionTable.userId, userId),
              eq(connectionTable.consumerId, consumerId),
              eq(connectionTable.collectionId, collectionId),
            ),
          )
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendConnection(updated);
  }).pipe(Effect.withSpan("connections.update", { attributes: { userId } }));
