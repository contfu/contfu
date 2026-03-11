import { Effect } from "effect";
import { count, eq } from "drizzle-orm";
import type { BackendConnection } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable, collectionTable } from "../../infra/db/schema";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const getConnectionWithCollectionCount = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            connection: connectionTable,
            collectionCount: count(collectionTable.id),
          })
          .from(connectionTable)
          .leftJoin(collectionTable, eq(collectionTable.connectionId, connectionTable.id))
          .where(eq(connectionTable.id, id))
          .groupBy(connectionTable.id)
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return undefined;

    return {
      ...mapToBackendConnection(row.connection),
      collectionCount: row.collectionCount,
    } as BackendConnection & { collectionCount: number };
  }).pipe(
    Effect.withSpan("connections.getWithCollectionCount", {
      attributes: { connectionId: id },
    }),
  );
