import { eq } from "drizzle-orm";
import type { BackendUserSummary, UserRole } from "../../domain/types";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";

export interface UpdateUserDto {
  id: number;
  approved?: boolean;
  role?: UserRole;
}

/**
 * Update a user's approval status or role.
 */
export async function updateUser(dto: UpdateUserDto): Promise<BackendUserSummary | null> {
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

  const results = await db
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
    });

  return results[0] ?? null;
}
