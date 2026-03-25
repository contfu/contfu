import { ConnectionType } from "@contfu/core";
import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { connectionTable } from "../../infra/db/schema";

/**
 * Find a connection by its credentials (API key).
 * Matches CLIENT-type connections only.
 * INTERNAL USE ONLY - for API authentication.
 */
export const findConnectionByKey = (key: Buffer) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [result] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: connectionTable.id,
            userId: connectionTable.userId,
            name: connectionTable.name,
            includeRef: connectionTable.includeRef,
          })
          .from(connectionTable)
          .where(
            and(
              eq(connectionTable.credentials, key),
              eq(connectionTable.type, ConnectionType.CLIENT),
            ),
          )
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result;
  }).pipe(Effect.withSpan("connections.findByKey"));
