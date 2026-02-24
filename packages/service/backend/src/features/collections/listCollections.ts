import { Effect } from "effect";
import { eq, sql } from "drizzle-orm";
import type { BackendCollection } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, influxTable, connectionTable } from "../../infra/db/schema";

/**
 * List all Collections for a user with counts.
 * These are the collections that consumers can subscribe to.
 */
export const listCollections = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const collections = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(collectionTable)
          .where(eq(collectionTable.userId, userId))
          .orderBy(collectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // Get influx counts per collection
    const influxCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: influxTable.collectionId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(influxTable)
          .where(eq(influxTable.userId, userId))
          .groupBy(influxTable.collectionId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const influxCountMap = new Map<number, number>(
      influxCounts.map((c) => [c.collectionId, c.count]),
    );

    // Get connection counts per collection
    const connectionCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: connectionTable.collectionId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(connectionTable)
          .where(eq(connectionTable.userId, userId))
          .groupBy(connectionTable.collectionId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const connectionCountMap = new Map<number, number>(
      connectionCounts.map((c) => [c.collectionId, c.count]),
    );

    return collections.map(
      (c) =>
        ({
          id: c.id,
          userId: c.userId,
          displayName: c.displayName,
          name: c.name,
          includeRef: c.includeRef,
          influxCount: influxCountMap.get(c.id) ?? 0,
          connectionCount: connectionCountMap.get(c.id) ?? 0,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }) satisfies BackendCollection,
    );
  }).pipe(Effect.withSpan("collections.list", { attributes: { userId } }));
