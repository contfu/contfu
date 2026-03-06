import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { collectionTable, consumerCollectionTable, consumerTable } from "../../infra/db/schema";
import type { BackendConsumerCollectionWithDetails } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Get all consumer-collection joins for a user with consumer and collection names.
 */
export const listConsumerCollections = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
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
          .where(eq(consumerCollectionTable.userId, userId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return rows as BackendConsumerCollectionWithDetails[];
  }).pipe(Effect.withSpan("consumers.listConsumerCollections", { attributes: { userId } }));
