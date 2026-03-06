import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { consumerCollectionTable, type ConsumerCollection } from "../../infra/db/schema";
import type { BackendConsumerCollection, UpdateConsumerCollectionInput } from "../../domain/types";
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
 * Update a consumer-collection join.
 */
export const updateConsumerCollection = (
  userId: number,
  consumerId: number,
  collectionId: number,
  input: UpdateConsumerCollectionInput,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(consumerCollectionTable)
          .set(input)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              eq(consumerCollectionTable.consumerId, consumerId),
              eq(consumerCollectionTable.collectionId, collectionId),
            ),
          )
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendConsumerCollection(updated);
  }).pipe(Effect.withSpan("consumers.updateConsumerCollection", { attributes: { userId } }));
