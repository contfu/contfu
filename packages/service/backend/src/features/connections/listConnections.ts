import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { collectionTable, connectionTable, consumerTable } from "../../infra/db/schema";
import type { BackendConnectionWithDetails } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Get all connections for a user with consumer and collection names.
 */
export const listConnections = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const connections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            userId: connectionTable.userId,
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            includeRef: connectionTable.includeRef,
            lastItemChanged: connectionTable.lastItemChanged,
            lastConsistencyCheck: connectionTable.lastConsistencyCheck,
            consumerName: consumerTable.name,
            collectionName: collectionTable.displayName,
          })
          .from(connectionTable)
          .innerJoin(
            consumerTable,
            and(
              eq(connectionTable.userId, consumerTable.userId),
              eq(connectionTable.consumerId, consumerTable.id),
            ),
          )
          .innerJoin(
            collectionTable,
            and(
              eq(connectionTable.userId, collectionTable.userId),
              eq(connectionTable.collectionId, collectionTable.id),
            ),
          )
          .where(eq(connectionTable.userId, userId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return connections as BackendConnectionWithDetails[];
  }).pipe(Effect.withSpan("connections.list", { attributes: { userId } }));
