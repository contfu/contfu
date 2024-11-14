import { db, quotaTable, userTable } from "@contfu/db";
import { eq } from "drizzle-orm";
import { hash } from "node:crypto";
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
    const activationToken = hash("sha256", session.id, "buffer");
    [user] = await db
      .insert(userTable)
      .values({
        email: customer.email!,
        name: customer.name!,
        activationToken: activationToken,
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
