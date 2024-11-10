import type { Session, User } from "@contfu/db";
import { db, sessionTable, userTable } from "@contfu/db";
import { eq } from "drizzle-orm";
import { hash, randomBytes } from "node:crypto";

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_TOKEN_LENGTH = 24;

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_LENGTH).toString("base64url");
}

export async function createSession(
  token: string,
  userId: number,
): Promise<Session> {
  const sessionId = getSessionId(token);
  const s: Session = {
    id: sessionId,
    userId,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  await db.insert(sessionTable).values(s).returning();
  return s;
}

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = getSessionId(token);
  const [result] = await db
    .select({ user: userTable, session: sessionTable })
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...sessionUser } = user;
  return {
    session,
    user: sessionUser,
  };
}

export async function invalidateSession(sessionId: Buffer) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

async function refreshSession(session: {
  id: unknown;
  userId: number;
  expiresAt: number;
}) {
  session.expiresAt = Date.now() + SESSION_DURATION;
  await db
    .update(sessionTable)
    .set({ expiresAt: session.expiresAt })
    .where(eq(sessionTable.id, session.id));
}

function getSessionId(token: string) {
  return hash("sha256", token, "buffer");
}

export type SessionUser = Omit<User, "password">;

export type SessionValidationResult = {
  session: Session;
  user: SessionUser;
} | null;
