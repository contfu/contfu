import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable } from "../../infra/db/schema";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const renameConnection = (id: number, name: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(connectionTable)
          .set({ name, updatedAt: new Date() })
          .where(eq(connectionTable.id, id))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendConnection(updated);
  }).pipe(Effect.withSpan("connections.rename", { attributes: { connectionId: id } }));
