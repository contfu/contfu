import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable } from "../../infra/db/schema";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const getConnection = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [row] = yield* Effect.tryPromise({
      try: () => db.select().from(connectionTable).where(eq(connectionTable.id, id)).limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return undefined;

    return mapToBackendConnection(row);
  }).pipe(Effect.withSpan("connections.get", { attributes: { connectionId: id } }));
