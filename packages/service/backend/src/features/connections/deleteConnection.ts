import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable, collectionTable, flowTable } from "../../infra/db/schema";
import { publishCountDelta } from "../../infra/cache/quota-cache";
import { teardownPushConsumer } from "../../infra/nats/push-consumers";

export const deleteConnection = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    // Find all flows targeting collections of this connection before deletion,
    // so we can teardown their NATS push consumers.
    const targetFlows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ targetId: flowTable.targetId })
          .from(flowTable)
          .innerJoin(collectionTable, eq(flowTable.targetId, collectionTable.id))
          .where(eq(collectionTable.connectionId, id)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const result = yield* Effect.tryPromise({
      try: () => db.delete(connectionTable).where(eq(connectionTable.id, id)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // The cascade delete removes all collections (and their flows) automatically.
    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.sync(() => publishCountDelta(result[0].userId, { connections: -1 }));
      for (const { targetId } of targetFlows) {
        yield* teardownPushConsumer(id, targetId);
      }
    }

    return deleted;
  }).pipe(Effect.withSpan("connections.delete", { attributes: { connectionId: id } }));
