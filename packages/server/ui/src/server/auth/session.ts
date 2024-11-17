import type { RequestEvent } from "@builder.io/qwik-city";
import {
  db,
  sessionTable,
  userTable,
  type Session as DbSession,
  type User,
} from "@contfu/db";
import { eq } from "drizzle-orm";
import { hash, randomBytes } from "node:crypto";

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days
export const SESSION_TOKEN_LENGTH = 24;
export const SESSION_COOKIE_NAME = "s";

export type DisplayUser = { email: string; name: string; image?: string };

export function getSession({
  sharedMap,
}: Pick<RequestEvent, "sharedMap">): Session | null {
  return sharedMap.get("session") ?? null;
}

export function guardLoggedIn({
  sharedMap,
  redirect,
}: Pick<RequestEvent, "sharedMap" | "redirect">) {
  if (!getSession({ sharedMap })) throw redirect(302, "/login");
}

export function guardLoggedOut({
  sharedMap,
  redirect,
  method,
  error,
}: Pick<RequestEvent, "sharedMap" | "redirect" | "method" | "error">) {
  if (getSession({ sharedMap })) {
    if (method === "GET") throw redirect(302, "/dashboard");
    else throw error(403, "Forbidden");
  }
}

export async function generateSessionToken(): Promise<string> {
  return randomBytes(SESSION_TOKEN_LENGTH).toString("base64url");
}

export async function createSession(
  token: string,
  userId: number,
): Promise<DbSession> {
  const sessionId = await getSessionId(token);
  const s: DbSession = {
    id: sessionId,
    userId,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  await db.insert(sessionTable).values(s).returning();
  return s;
}

export async function validateSessionToken(
  token: string,
  image?: string,
): Promise<Session | null> {
  const sessionId = await getSessionId(token);
  const [result] = await db
    .select({
      user: {
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        oauthId: userTable.oauthId,
      },
      session: sessionTable,
    })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId));
  if (!result) return null;
  const { user, session } = result;
  if (Date.now() >= session.expiresAt) {
    await db.delete(sessionTable).where(eq(sessionTable.id, session.id));
    return null;
  }
  if (Date.now() >= session.expiresAt - SESSION_DURATION / 2) {
    await refreshSession(session);
  }
  return {
    id: session.id,
    expiresAt: session.expiresAt,
    user: { ...user, image },
  };
}

export async function invalidateSession(sessionId: Buffer) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

async function refreshSession(session: DbSession) {
  session.expiresAt = Date.now() + SESSION_DURATION;
  await db
    .update(sessionTable)
    .set({ expiresAt: session.expiresAt })
    .where(eq(sessionTable.id, session.id));
}

async function getSessionId(token: string) {
  return hash("sha256", token, "buffer");
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "oauthId"> & {
  image?: string;
};

export type Session = {
  id: Buffer;
  expiresAt: number;
  user: SessionUser;
};
