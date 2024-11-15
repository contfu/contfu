import type { Session as DbSession, User } from "@contfu/db";

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_TOKEN_LENGTH = 24;

export async function generateSessionToken(): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(SESSION_TOKEN_LENGTH).toString("base64url");
}

export async function createSession(
  token: string,
  userId: number,
): Promise<DbSession> {
  const { db, sessionTable } = await import("@contfu/db");
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
): Promise<Session | null> {
  const { db, sessionTable, userTable } = await import("@contfu/db");
  const { eq } = await import("drizzle-orm");
  const sessionId = await getSessionId(token);
  const [result] = await db
    .select({
      user: {
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
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
    user,
  };
}

export async function invalidateSession(sessionId: Buffer) {
  const { db, sessionTable } = await import("@contfu/db");
  const { eq } = await import("drizzle-orm");
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

async function refreshSession(session: DbSession) {
  const { db, sessionTable } = await import("@contfu/db");
  const { eq } = await import("drizzle-orm");
  session.expiresAt = Date.now() + SESSION_DURATION;
  await db
    .update(sessionTable)
    .set({ expiresAt: session.expiresAt })
    .where(eq(sessionTable.id, session.id));
}

async function getSessionId(token: string) {
  const { hash } = await import("node:crypto");
  return hash("sha256", token, "buffer");
}

export type SessionUser = Pick<User, "id" | "email" | "name">;

export type Session = {
  id: Buffer;
  expiresAt: number;
  user: SessionUser;
};
