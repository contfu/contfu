import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { consumerCollectionTable, type ConsumerCollection } from "../../infra/db/schema";
import type { BackendConsumerCollection } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

function mapToBackendConsumerCollection(cc: ConsumerCollection): BackendConsumerCollection {
  return {
    userId: cc.userId,
    consumerId: cc.consumerId,
    collectionId: cc.collectionId,
    includeRef: cc.includeRef,
    lastItemChanged: cc.lastItemChanged,
    lastConsistencyCheck: cc.lastConsistencyCheck,
  };
}

/**
 * Get a single consumer-collection join by consumer and collection ID.
 */
export const getConsumerCollection = (userId: number, consumerId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [cc] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(consumerCollectionTable)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              eq(consumerCollectionTable.consumerId, consumerId),
              eq(consumerCollectionTable.collectionId, collectionId),
            ),
          )
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!cc) return undefined;

    return mapToBackendConsumerCollection(cc);
  }).pipe(Effect.withSpan("consumers.getConsumerCollection", { attributes: { userId } }));
