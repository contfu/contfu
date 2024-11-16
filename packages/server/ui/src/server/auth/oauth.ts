import { db, userTable } from "@contfu/db";
import { GitHub } from "arctic";
import { eq } from "drizzle-orm";
import { getUserByRegistrationToken } from "../stripe/customers";
import type { DisplayUser } from "./session";
import { createSession, generateSessionToken } from "./session";

export const OAUTH_STATE_COOKIE_NAME = "o";
export const REGISTRATION_TOKEN_COOKIE_NAME = "r";

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.ORIGIN ?? "http://localhost:5173"}/login/github/callback`,
);

export async function login(id: string) {
  console.log("login", { id });
  const user = await db.query.user.findFirst({
    where: eq(userTable.oauthId, id),
  });

  if (!user) return null;

  const token = await generateSessionToken();
  await createSession(token, user.id);

  return {
    token,
    user: { email: user.email, name: user.name } as DisplayUser,
  };
}

export async function activateUser(registrationToken: Buffer, id: string) {
  console.log("activateUser", {
    registrationToken: registrationToken.toString("hex"),
    id,
  });
  const user = await getUserByRegistrationToken(registrationToken);
  console.log("user", user);

  if (!user) return null;

  await db
    .update(userTable)
    .set({
      oauthId: id,
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
