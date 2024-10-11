import { and, eq, sql } from "drizzle-orm";
import { withSchema } from "../../core/db";
import { account, Client, client, Quota, quota } from "./access-schema";

const db = withSchema({ account, client, quota });

export type QuotaLimits = Pick<
  Quota,
  "maxSources" | "maxCollections" | "maxItems" | "maxClients"
>;

export async function authenticateClient(key: Buffer) {
  const c = await db.query.client.findFirst({ where: eq(client.key, key) });
  return c ?? null;
}

export async function createAccount(
  email: string,
  limits: QuotaLimits,
  activeUntil: Date
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

export async function createClient(accountId: number, name?: string) {
  const nextId = sql`(
    SELECT COALESCE(MAX(${client.id}), 0) + 1
    FROM ${client}
    WHERE ${client.accountId} = ${accountId}
  )`;
  const key = await generateAccessKey(
    24,
    async (key) =>
      !!(await db.query.client.findFirst({
        where: eq(client.key, key),
      }))
  );
  return (
    await db
      .insert(client)
      .values({ accountId, name, id: nextId, key })
      .returning()
  )[0];
}

export async function updateClient({
  accountId,
  id,
  ...c
}: Pick<Client, "id" | "accountId"> &
  Partial<Pick<Client, "key" | "name" | "connectedTo">>) {
  await db
    .update(client)
    .set(c)
    .where(and(eq(client.id, id), eq(client.accountId, accountId)));
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
