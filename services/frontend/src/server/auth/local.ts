import { db, userTable } from "@contfu/db";
import { hash, verify } from "argon2";
import { eq } from "drizzle-orm";
import { getUserByRegistrationToken } from "../stripe/customers";
import type { DisplayUser } from "./session";
import { createSession, generateSessionToken } from "./session";

export async function login(email: string, password: string) {
  let user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.email, email),
  });
  if (import.meta.env.DEV && !user) {
    [user] = await db
      .insert(userTable)
      .values({
        email: "test@test.com",
        name: "Test User",
        password: await hash("test"),
      })
      .returning();
  }

  if (!user || !user.password || !(await verify(user.password, password)))
    return null;

  const token = await generateSessionToken();
  await createSession(token, user.id);
  return { token, user: { email: user.email, name: user.name } as DisplayUser };
}

export async function activateUser(
  registrationToken: Buffer,
  password: string,
) {
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
