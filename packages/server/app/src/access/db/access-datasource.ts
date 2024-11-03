import { and, eq, sql } from "drizzle-orm";
import { withSchema } from "../../core/db/db";
import { account, consumer, DbConsumer, DbQuota, quota } from "./access-schema";

const db = withSchema({ account, consumer, quota });

export type QuotaLimits = Pick<
  DbQuota,
  "maxSources" | "maxCollections" | "maxItems" | "maxClients"
>;

export async function authenticateConsumer(key: Buffer) {
  if (key.length !== 24) return null;
  const c = await db.query.consumer.findFirst({ where: eq(consumer.key, key) });
  return c ?? null;
}

export async function createAccount(
  email: string,
  limits: QuotaLimits,
  activeUntil: number
) {
  const acc = (
    await db.insert(account).values({ email, activeUntil }).returning()
  )[0];
  await createQuota(acc.id, limits);
  return acc;
}

export async function createQuota(accountId: number, limits: QuotaLimits) {
  return (
    await db
      .insert(quota)
      .values({
        id: accountId,
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
  accountId: number,
  name: string,
  internal?: boolean
) {
  const id = sql`(
    SELECT COALESCE(MAX(${consumer.id}), 0) + 1
    FROM ${consumer}
    WHERE ${consumer.accountId} = ${accountId}
  )`;
  const key = internal
    ? null
    : await generateAccessKey(
        24,
        async (key) =>
          !!(await db.query.consumer.findFirst({
            where: eq(consumer.key, key),
          }))
      );
  return (
    await db.insert(consumer).values({ accountId, name, id, key }).returning()
  )[0];
}

export async function updateConsumer({
  accountId,
  id,
  ...c
}: Pick<DbConsumer, "id" | "accountId"> &
  Partial<Pick<DbConsumer, "key" | "name">>) {
  await db
    .update(consumer)
    .set(c)
    .where(and(eq(consumer.id, id), eq(consumer.accountId, accountId)));
}

async function generateAccessKey(
  length: number,
  isCollision: (key: Buffer) => Promise<boolean>
) {
  do {
    const key = generateRandomKey(length);
    if (!(await isCollision(key))) return key;
  } while (true);
}

function generateRandomKey(length: number) {
  return crypto.getRandomValues(Buffer.allocUnsafe(length));
}
