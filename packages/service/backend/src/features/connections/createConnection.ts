import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  type Connection,
} from "../../infra/db/schema";
import type { BackendConnection, CreateConnectionInput } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError, NotFoundError } from "../../effect/errors";

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
 * Create a new connection for a user.
 */
export const createConnection = (userId: number, input: CreateConnectionInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [consumer, collection] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          db
            .select({ id: consumerTable.id })
            .from(consumerTable)
            .where(and(eq(consumerTable.id, input.consumerId), eq(consumerTable.userId, userId)))
            .limit(1),
          db
            .select({ id: collectionTable.id })
            .from(collectionTable)
            .where(
              and(eq(collectionTable.id, input.collectionId), eq(collectionTable.userId, userId)),
            )
            .limit(1),
        ]),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!consumer[0]) {
      return yield* new NotFoundError({ entity: "Consumer", id: input.consumerId });
    }
    if (!collection[0]) {
      return yield* new NotFoundError({ entity: "Collection", id: input.collectionId });
    }

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(connectionTable)
          .values({
            userId,
            consumerId: input.consumerId,
            collectionId: input.collectionId,
            includeRef: input.includeRef ?? true,
            lastItemChanged: input.lastItemChanged ?? null,
            lastConsistencyCheck: input.lastConsistencyCheck ?? null,
          })
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return mapToBackendConnection(inserted);
  }).pipe(Effect.withSpan("connections.create", { attributes: { userId } }));
