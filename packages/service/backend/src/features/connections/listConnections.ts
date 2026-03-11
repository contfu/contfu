import { Effect } from "effect";
import { count, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable, collectionTable } from "../../infra/db/schema";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const listConnections = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            connection: connectionTable,
            collectionCount: count(collectionTable.id),
          })
          .from(connectionTable)
          .leftJoin(collectionTable, eq(collectionTable.connectionId, connectionTable.id))
          .groupBy(connectionTable.id)
          .orderBy(connectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return rows.map((row) => ({
      ...mapToBackendConnection(row.connection),
      collectionCount: row.collectionCount,
    }));
  }).pipe(Effect.withSpan("connections.list"));
