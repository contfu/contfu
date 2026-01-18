import { error, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { hash, randomBytes } from "node:crypto";
import {
  db,
  sessionTable,
  userTable,
  type Session as DbSession,
  type User,
} from "$lib/server/db/db";

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30;
export const SESSION_TOKEN_LENGTH = 24;
export const SESSION_COOKIE_NAME = "s";

export type DisplayUser = { email: string; name: string; image?: string };

export function guardLoggedIn(locals: App.Locals) {
  if (!locals.session) throw redirect(302, "/login");
}

export function guardLoggedOut(locals: App.Locals, method: string) {
  if (locals.session) {
    if (method === "GET") throw redirect(302, "/dashboard");
    else throw error(403, "Forbidden");
  }
}

export async function generateSessionToken(): Promise<string> {
  return randomBytes(SESSION_TOKEN_LENGTH).toString("base64url");
}

export async function createSession(token: string, userId: number): Promise<DbSession> {
  const sessionId = await getSessionId(token);
  const s: DbSession = {
    id: sessionId,
    userId,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  await db.insert(sessionTable).values(s).returning();
  return s;
}

export async function validateSessionToken(token: string, image?: string): Promise<Session | null> {
  const sessionId = await getSessionId(token);
  const results = await db
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
    .where(eq(sessionTable.id, sessionId))
    .limit(1)
    .all();

  if (results.length === 0) return null;
  const { user, session } = results[0];
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
