import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getStripeProducts } from "$lib/server/stripe/products";

export const load: PageServerLoad = async () => {
  if (!process.env.STRIPE_TEST_KEY && !process.env.STRIPE_KEY) {
    throw redirect(302, "/under-construction");
  }

  const products = (await getStripeProducts()).filter((p) => !p.hidden);
  return { products };
};
