import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import type { UserRole } from "../../infra/db/constants";
import { eq } from "drizzle-orm";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
}

export interface UpdateUserDto {
  id: number;
  approved?: boolean;
  role?: UserRole;
}

/**
 * Update a user's approval status or role.
 */
export async function updateUser(dto: UpdateUserDto): Promise<UserSummary | null> {
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

  const result = await db
    .update(userTable)
    .set(updateData)
    .where(eq(userTable.id, dto.id))
    .returning({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      role: userTable.role,
      approved: userTable.approved,
      createdAt: userTable.createdAt,
    })
    .get();

  return result ?? null;
}
