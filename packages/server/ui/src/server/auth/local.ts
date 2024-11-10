import { db } from "@contfu/db";
import type { DisplayUser } from "./auth";
import { createSession, generateSessionToken } from "./session";

export async function login(email: string, password: string) {
  const user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.email, email),
  });

  if (
    !user ||
    !user.password ||
    !(await Bun.password.verify(password, user.password))
  )
    return null;

  const token = generateSessionToken();
  await createSession(token, user.id);
  return { token, user: { email: user.email, name: user.name } as DisplayUser };
}
