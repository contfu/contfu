import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerTable, type Consumer } from "../../infra/db/schema";

/**
 * Get a consumer with raw API key buffer.
 * INTERNAL USE ONLY - for API authentication that needs the actual key.
 * Returns undefined if not found or not owned by the user.
 */
export const getConsumerWithKey = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [consumer] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(consumerTable)
          .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return consumer as Consumer | undefined;
  }).pipe(Effect.withSpan("consumers.getWithKey", { attributes: { userId, consumerId: id } }));
