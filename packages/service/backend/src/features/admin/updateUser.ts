import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { BackendUserSummary, UserRole } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { userTable } from "../../infra/db/schema";

export interface UpdateUserDto {
  id: number;
  approved?: boolean;
  role?: UserRole;
}

/**
 * Update a user's approval status or role.
 */
export const updateUser = (dto: UpdateUserDto) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const updateData: {
      approved?: boolean;
      role?: UserRole;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.approved !== undefined) {
      updateData.approved = dto.approved;
    }

    if (dto.role !== undefined) {
      updateData.role = dto.role;
    }

    const results = yield* Effect.tryPromise({
      try: () =>
        db.update(userTable).set(updateData).where(eq(userTable.id, dto.id)).returning({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          emailVerified: userTable.emailVerified,
          role: userTable.role,
          approved: userTable.approved,
          createdAt: userTable.createdAt,
        }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return (results[0] ?? null) as BackendUserSummary | null;
  }).pipe(Effect.withSpan("admin.updateUser", { attributes: { userId: dto.id } }));
