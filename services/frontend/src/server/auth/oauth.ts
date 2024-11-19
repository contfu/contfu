import { db, userTable } from "@contfu/db";
import { GitHub, Google } from "arctic";
import { eq } from "drizzle-orm";
import { getUserByRegistrationToken } from "../stripe/customers";
import type { DisplayUser } from "./session";
import { createSession, generateSessionToken } from "./session";

export const OAUTH_STATE_COOKIE_NAME = "o";
export const OAUTH_VERIFIER_COOKIE_NAME = "v";
export const REGISTRATION_TOKEN_COOKIE_NAME = "r";

export const oauthProviders = ["github", "google"] as const;

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.ORIGIN ?? "http://localhost:5173"}/login/github/callback`,
);

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.ORIGIN ?? "http://localhost:5173"}/login/google/callback`,
);

export async function login(id: string) {
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
  const user = await getUserByRegistrationToken(registrationToken);

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
