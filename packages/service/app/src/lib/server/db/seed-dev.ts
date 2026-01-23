import { auth } from "$lib/server/auth/auth";
import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sql/sqlite";
import type * as schema from "./schema";
import { accountTable, userTable } from "./schema";

/**
 * Seeds a test user for development and testing purposes.
 * This script runs when NODE_ENV is not 'production' or when TEST_MODE is set.
 * It is idempotent - running it multiple times won't create duplicates.
 *
 * Test User Credentials:
 * - Email: test@test.com
 * - Password: test
 */

const TEST_USER = {
  email: "test@test.com",
  password: "test",
  name: "Test User",
};

/**
 * Seeds the development test user into the database.
 * @param database - The drizzle database instance
 */
export async function seedDevUser(database: BunSQLiteDatabase<typeof schema>): Promise<void> {
  // Only run in development mode or when TEST_MODE is set
  if (process.env.NODE_ENV === "production" && !process.env.TEST_MODE) {
    return;
  }

  // Check if user already exists
  const existingUser = await database
    .select()
    .from(userTable)
    .where(eq(userTable.email, TEST_USER.email))
    .limit(1);

  if (existingUser.length > 0) {
    return;
  }

  // Get the password hasher from better-auth context
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(TEST_USER.password);

  const now = new Date();

  // Insert the test user
  const [user] = await database
    .insert(userTable)
    .values({
      name: TEST_USER.name,
      email: TEST_USER.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: userTable.id });

  // Create the credential account with hashed password
  await database.insert(accountTable).values({
    accountId: String(user.id),
    providerId: "credential",
    userId: user.id,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });
}
