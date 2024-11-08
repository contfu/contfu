import { and, eq, sql } from "drizzle-orm";
import { withSchema } from "../../core/db/db";
import { consumer, DbConsumer, DbQuota, quota, user } from "./access-schema";

const db = withSchema({ user, consumer, quota });

export type QuotaLimits = Pick<
  DbQuota,
  "maxSources" | "maxCollections" | "maxItems" | "maxClients"
>;

export async function verifyUserCredentials(email: string, password: string) {
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (!u || !u.password || !(await Bun.password.verify(password, u.password)))
    return null;
  return u.activeUntil ?? Infinity;
}

export async function authenticateConsumer(key: Buffer) {
  if (key.length !== 24) return null;
  const c = await db.query.consumer.findFirst({ where: eq(consumer.key, key) });
  return c ?? null;
}

export async function createUser(
  email: string,
  limits: QuotaLimits,
  activeUntil: number,
) {
  const acc = (
    await db.insert(user).values({ email, activeUntil }).returning()
  )[0];
  await createQuota(acc.id, limits);
  return acc;
}

export async function createQuota(userId: number, limits: QuotaLimits) {
  return (
    await db
      .insert(quota)
      .values({
        id: userId,
        ...limits,
        sources: 0,
        collections: 0,
        items: 0,
        clients: 0,
      })
      .returning()
  )[0];
}

export async function createConsumer(
  userId: number,
  name: string,
  internal?: boolean,
) {
  const id = sql`(
    SELECT COALESCE(MAX(${consumer.id}), 0) + 1
    FROM ${consumer}
    WHERE ${consumer.userId} = ${userId}
  )`;
  const key = internal
    ? null
    : await generateAccessKey(
        24,
        async (key) =>
          !!(await db.query.consumer.findFirst({
            where: eq(consumer.key, key),
          })),
      );
  return (
    await db.insert(consumer).values({ userId, name, id, key }).returning()
  )[0];
}

export async function updateConsumer({
  userId,
  id,
  ...c
}: Pick<DbConsumer, "id" | "userId"> &
  Partial<Pick<DbConsumer, "key" | "name">>) {
  await db
    .update(consumer)
    .set(c)
    .where(and(eq(consumer.id, id), eq(consumer.userId, userId)));
}

async function generateAccessKey(
  length: number,
  isCollision: (key: Buffer) => Promise<boolean>,
) {
  do {
    const key = generateRandomKey(length);
    if (!(await isCollision(key))) return key;
  } while (true);
}

function generateRandomKey(length: number) {
  return crypto.getRandomValues(Buffer.allocUnsafe(length));
}
