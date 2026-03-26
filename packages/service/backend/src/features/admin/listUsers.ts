import { Effect } from "effect";
import { desc } from "drizzle-orm";
import type { BackendUserSummary } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { userTable } from "../../infra/db/schema";

/**
 * List all users with summary info.
 */
export const listUsers = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const users = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            emailVerified: userTable.emailVerified,
            role: userTable.role,
            basePlan: userTable.basePlan,
            approved: userTable.approved,
            createdAt: userTable.createdAt,
          })
          .from(userTable)
          .orderBy(desc(userTable.createdAt)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return users as BackendUserSummary[];
  }).pipe(Effect.withSpan("admin.listUsers"));
