import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { connectionTable, type Connection } from "../../infra/db/schema";
import type { BackendConnection } from "../../domain/types";
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
 * Get a single connection by consumer and collection ID.
 */
export const getConnection = (userId: number, consumerId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [connection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(connectionTable)
          .where(
            and(
              eq(connectionTable.userId, userId),
              eq(connectionTable.consumerId, consumerId),
              eq(connectionTable.collectionId, collectionId),
            ),
          )
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!connection) return undefined;

    return mapToBackendConnection(connection);
  }).pipe(Effect.withSpan("connections.get", { attributes: { userId } }));
