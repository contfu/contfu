import type { Stripe } from "stripe";

export let stripe: Stripe | undefined;

export async function getStripe() {
  const { Stripe } = await import("stripe");
  stripe ??= new Stripe(process.env.STRIPE_TEST_KEY!);
  return stripe;
}
