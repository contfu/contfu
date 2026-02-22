import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerTable, type Consumer } from "../../infra/db/schema";

/**
 * Find a consumer by API key.
 * INTERNAL USE ONLY - for API authentication.
 */
export const findConsumerByKey = (key: Buffer) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [consumer] = yield* Effect.tryPromise({
      try: () => db.select().from(consumerTable).where(eq(consumerTable.key, key)).limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return consumer as Consumer | undefined;
  }).pipe(Effect.withSpan("consumers.findByKey"));
