import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  type ConsumerCollection,
} from "../../infra/db/schema";
import type { BackendConsumerCollection, CreateConsumerCollectionInput } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError, NotFoundError } from "../../effect/errors";

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
 * Create a new consumer-collection join for a user.
 */
export const connectCollectionToConsumer = (userId: number, input: CreateConsumerCollectionInput) =>
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
          .insert(consumerCollectionTable)
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

    return mapToBackendConsumerCollection(inserted);
  }).pipe(Effect.withSpan("consumers.connectCollectionToConsumer", { attributes: { userId } }));
