import { Stripe } from "stripe";
import { building } from "$app/environment";

// Lazy initialization to avoid build-time errors when env vars aren't available
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (building) {
    throw new Error("Stripe cannot be used during build time");
  }
  if (!_stripe) {
    const apiKey = process.env.STRIPE_TEST_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_TEST_KEY environment variable is not set");
    }
    _stripe = new Stripe(apiKey);
  }
  return _stripe;
}

// For backwards compatibility - lazily initialized
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (building) {
      // Return a no-op during build to allow static analysis
      return () => Promise.resolve({ data: [] });
    }
    return Reflect.get(getStripe(), prop);
  },
});
