import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { flowTable } from "../../infra/db/schema";
import { decrementCount } from "../../infra/nats/quota-kv";

/**
 * Delete a flow by ID, scoped to the current user via RLS.
 */
export const deleteFlow = (flowId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () => db.delete(flowTable).where(eq(flowTable.id, flowId)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (result.length > 0) {
      yield* Effect.promise(() => decrementCount(result[0].userId, "flows"));
      return true;
    }
    return false;
  }).pipe(Effect.withSpan("flows.delete", { attributes: { flowId } }));
