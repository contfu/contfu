import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { settingTable } from "../../infra/db/schema";

/**
 * Get a system setting by key.
 * Returns the raw value (may be encrypted).
 */
export const getSetting = (key: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ value: settingTable.value })
          .from(settingTable)
          .where(eq(settingTable.key, key))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return (row?.value as Buffer | null) ?? null;
  }).pipe(Effect.withSpan("admin.getSetting", { attributes: { key } }));
