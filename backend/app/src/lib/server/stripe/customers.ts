import { SESSION_TOKEN_LENGTH } from "$lib/server/auth/constants";
import { db } from "$lib/server/db/db";
import { quotaTable, userTable } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getStripeProducts } from "./products";
import { stripe } from "./stripe";

export const REGISTRATION_TOKEN_STRING_LENGTH = Math.ceil((SESSION_TOKEN_LENGTH / 3) * 4);

export async function setCustomerSubscription(session: Stripe.Checkout.Session) {
  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  const customer = session.customer_details!;
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, customer.email!))
    .limit(1)
    .all();
  let user = users[0];

  if (!user) {
    const registrationToken = await sessionIdToToken(session.id);
    [user] = await db
      .insert(userTable)
      .values({
        email: customer.email!,
        name: customer.name!,
        registrationToken,
        activeUntil: sub.current_period_end,
      })
      .returning();
  }
  const productId = sub.items.data[0].price.product as string;
  const product = (await getStripeProducts()).find((p) => p.id === productId)!;
  await db
    .insert(quotaTable)
    .values({
      id: user.id,
      maxSources: product.quota.maxSources,
      maxCollections: product.quota.maxCollections,
      maxItems: product.quota.maxItems,
      maxConsumers: product.quota.maxConsumers,
    })
    .onConflictDoUpdate({
      target: [quotaTable.id],
      set: {
        maxSources: product.quota.maxSources,
        maxCollections: product.quota.maxCollections,
        maxItems: product.quota.maxItems,
        maxConsumers: product.quota.maxConsumers,
      },
    });
}

export async function decodeRegistrationToken(token: string) {
  return token.length === REGISTRATION_TOKEN_STRING_LENGTH
    ? Buffer.from(token, "base64url")
    : await sessionIdToToken(token);
}

export async function sessionIdToToken(sessionId: string) {
  const { hash } = await import("node:crypto");
  return hash("sha256", sessionId, "buffer").subarray(0, SESSION_TOKEN_LENGTH);
}

export async function getUserByRegistrationToken(token: Buffer) {
  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.registrationToken, token))
    .limit(1)
    .all();

  return users[0] || null;
}
