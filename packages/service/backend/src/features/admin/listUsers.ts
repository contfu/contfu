import type { BackendUserSummary } from "../../domain/types";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import { desc } from "drizzle-orm";

/**
 * List all users with summary info.
 */
export async function listUsers(): Promise<BackendUserSummary[]> {
  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      role: userTable.role,
      approved: userTable.approved,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .orderBy(desc(userTable.createdAt));

  return users;
}
