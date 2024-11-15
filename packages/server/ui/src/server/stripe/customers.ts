import { db, quotaTable, userTable } from "@contfu/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getStripeProducts } from "./products";
import { stripe } from "./stripe";

export async function setCustomerSubscription(
  session: Stripe.Checkout.Session,
) {
  const sub = await stripe.subscriptions.retrieve(
    session.subscription as string,
  );
  const customer = session.customer_details!;
  let user = await db.query.user.findFirst({
    where: eq(userTable.email, customer.email!),
  });
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
  return token.length === 24
    ? Buffer.from(token, "base64url")
    : await sessionIdToToken(token);
}

export async function sessionIdToToken(sessionId: string) {
  const { hash } = await import("node:crypto");
  return hash("sha256", sessionId, "buffer").subarray(0, 18);
}

export async function getUserByRegistrationToken(token: Buffer) {
  const user = await db.query.user.findFirst({
    where: eq(userTable.registrationToken, token),
    columns: {
      id: true,
      name: true,
      email: true,
    },
  });

  return user;
}
