import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { settingTable } from "../../infra/db/schema";

/**
 * Create or update a system setting.
 */
export const upsertSetting = (key: string, value: Buffer) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    yield* Effect.tryPromise({
      try: () =>
        db
          .insert(settingTable)
          .values({ key, value })
          .onConflictDoUpdate({
            target: settingTable.key,
            set: { value, updatedAt: new Date() },
          }),
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("admin.upsertSetting", { attributes: { key } }));
