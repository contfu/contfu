import { dev } from "$app/environment";
import { db } from "$lib/server/db/db";
import { userTable } from "$lib/server/db/schema";
import { getUserByRegistrationToken } from "$lib/server/stripe/customers";
import { hash, verify } from "argon2";
import { eq } from "drizzle-orm";
import type { DisplayUser } from "./session";
import { createSession, generateSessionToken } from "./session";

export async function login(email: string, password: string) {
  const users = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1).all();
  let user = users[0];

  // Allow test user creation in dev mode or when TEST_MODE is set (for E2E tests)
  // Note: 'dev' is inlined as false during production build, so we check TEST_MODE at runtime
  // process.env works in both Bun and Node.js
  const testModeEnabled = process.env.TEST_MODE === "true";
  const allowTestUserCreation = dev || testModeEnabled;
  console.log(
    "[login] dev:",
    dev,
    "testModeEnabled:",
    testModeEnabled,
    "allowTestUserCreation:",
    allowTestUserCreation,
  );
  console.log("[login] email:", email, "user found:", !!user);
  if (allowTestUserCreation && !user && email === "test@test.com") {
    console.log("[login] Creating test user...");
    try {
      const result = await db
        .insert(userTable)
        .values({
          email: "test@test.com",
          name: "Test User",
          password: await hash("test"),
        })
        .returning();
      console.log("[login] Insert result:", result);
      user = result[0];
      // If returning() doesn't work, fetch the user we just created
      if (!user) {
        const users = await db
          .select()
          .from(userTable)
          .where(eq(userTable.email, email))
          .limit(1)
          .all();
        user = users[0];
        console.log("[login] Fetched user after insert:", user?.id);
      } else {
        console.log("[login] Test user created:", user?.id);
      }
    } catch (err) {
      console.error("[login] Failed to create test user:", err);
    }
  }

  if (!user || !user.password || !(await verify(user.password, password))) return null;

  const token = await generateSessionToken();
  await createSession(token, user.id);
  return { token, user: { email: user.email, name: user.name } as DisplayUser };
}

export async function activateUser(registrationToken: Buffer, password: string) {
  const user = await getUserByRegistrationToken(registrationToken);

  if (!user) {
    return null;
  }

  const hashedPassword = await hash(password);

  await db
    .update(userTable)
    .set({
      password: hashedPassword,
      registrationToken: null,
    })
    .where(eq(userTable.id, user.id));

  const token = await generateSessionToken();
  await createSession(token, user.id);

  return {
    token,
    user: {
      email: user.email,
      name: user.name,
    } as DisplayUser,
  };
}
