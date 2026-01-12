import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  Consumer,
  consumerTable,
  db,
  Quota,
  quotaTable,
  userTable,
} from "~/db/db";

export type QuotaLimits = Pick<
  Quota,
  "maxSources" | "maxCollections" | "maxItems" | "maxConsumers"
>;

export async function verifyUserCredentials(email: string, password: string) {
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1)
    .all();
  const u = users[0];
  if (!u || !u.password || !(await Bun.password.verify(password, u.password)))
    return null;
  return u.activeUntil ?? Infinity;
}

export async function authenticateConsumer(key: Buffer) {
  if (key.length !== 24) return null;
  const consumers = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1)
    .all();
  return consumers[0] ?? null;
}

export async function createUser(
  email: string,
  name: string,
  limits: QuotaLimits,
  activeUntil: number,
) {
  const acc = (
    await db.insert(userTable).values({ email, activeUntil, name }).returning()
  )[0];
  await createQuota(acc.id, limits);
  return acc;
}

export async function createQuota(userId: number, limits: QuotaLimits) {
  return (
    await db
      .insert(quotaTable)
      .values({
        id: userId,
        ...limits,
        sources: 0,
        collections: 0,
        items: 0,
        consumers: 0,
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
    SELECT COALESCE(MAX(${consumerTable.id}), 0) + 1
    FROM ${consumerTable}
    WHERE ${consumerTable.userId} = ${userId}
  )`;
  const key = internal
    ? null
    : await generateAccessKey(
        24,
        async (key) => {
          const existing = await db
            .select()
            .from(consumerTable)
            .where(eq(consumerTable.key, key))
            .limit(1)
            .all();
          return existing.length > 0;
        },
      );
  return (
    await db.insert(consumerTable).values({ userId, name, id, key }).returning()
  )[0];
}

export async function updateConsumer({
  userId,
  id,
  ...c
}: Pick<Consumer, "id" | "userId"> & Partial<Pick<Consumer, "key" | "name">>) {
  await db
    .update(consumerTable)
    .set(c)
    .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)));
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
