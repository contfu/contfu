import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import type { UserRole } from "../../infra/db/constants";
import { desc } from "drizzle-orm";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
}

/**
 * List all users with summary info.
 */
export async function listUsers(): Promise<UserSummary[]> {
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
