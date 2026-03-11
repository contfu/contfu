import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable, collectionTable, flowTable } from "../../infra/db/schema";
import { decrementCount } from "../../infra/nats/quota-kv";
import { teardownPushConsumer } from "../../infra/nats/push-consumers";

export const deleteConnection = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    // Find collections belonging to this connection that are flow targets,
    // so we can teardown their NATS push consumers.
    const targetFlows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            targetId: flowTable.targetId,
          })
          .from(flowTable)
          .innerJoin(collectionTable, eq(flowTable.targetId, collectionTable.id))
          .where(eq(collectionTable.connectionId, id)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const result = yield* Effect.tryPromise({
      try: () => db.delete(connectionTable).where(eq(connectionTable.id, id)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.promise(() => decrementCount(result[0].userId, "connections"));
      for (const { targetId } of targetFlows) {
        yield* teardownPushConsumer(id, targetId);
      }
    }

    return deleted;
  }).pipe(Effect.withSpan("connections.delete", { attributes: { connectionId: id } }));
