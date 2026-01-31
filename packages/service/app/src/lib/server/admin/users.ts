import { db } from "$lib/server/db/db";
import { userTable } from "$lib/server/db/schema";
import type { UserRole } from "$lib/constants/user";
import { desc, eq } from "drizzle-orm";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
}

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

export interface UpdateUserDto {
  id: number;
  approved?: boolean;
  role?: UserRole;
}

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
