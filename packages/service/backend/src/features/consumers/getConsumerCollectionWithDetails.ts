import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { collectionTable, consumerCollectionTable, consumerTable } from "../../infra/db/schema";
import type { BackendConsumerCollectionWithDetails } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Get a single consumer-collection join with consumer and collection details.
 */
export const getConsumerCollectionWithDetails = (
  userId: number,
  consumerId: number,
  collectionId: number,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [cc] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            userId: consumerCollectionTable.userId,
            consumerId: consumerCollectionTable.consumerId,
            collectionId: consumerCollectionTable.collectionId,
            includeRef: consumerCollectionTable.includeRef,
            lastItemChanged: consumerCollectionTable.lastItemChanged,
            lastConsistencyCheck: consumerCollectionTable.lastConsistencyCheck,
            consumerName: consumerTable.name,
            collectionName: collectionTable.displayName,
          })
          .from(consumerCollectionTable)
          .innerJoin(
            consumerTable,
            and(
              eq(consumerCollectionTable.userId, consumerTable.userId),
              eq(consumerCollectionTable.consumerId, consumerTable.id),
            ),
          )
          .innerJoin(
            collectionTable,
            and(
              eq(consumerCollectionTable.userId, collectionTable.userId),
              eq(consumerCollectionTable.collectionId, collectionTable.id),
            ),
          )
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

    return cc as BackendConsumerCollectionWithDetails | undefined;
  }).pipe(
    Effect.withSpan("consumers.getConsumerCollectionWithDetails", { attributes: { userId } }),
  );
