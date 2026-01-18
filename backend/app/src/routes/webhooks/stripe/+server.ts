import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { stripe } from "$lib/server/stripe/stripe";
import { setCustomerSubscription } from "$lib/server/stripe/customers";
import {
  deleteCachedPrice,
  deleteCachedProduct,
  refreshProducts,
  upsertCachedPrice,
  upsertCachedProduct,
} from "$lib/server/stripe/products";

export const POST: RequestHandler = async ({ request }) => {
  const sig = request.headers.get("stripe-signature");
  if (!sig) throw error(400, "No signature");

  const body = await request.arrayBuffer();
  const event = stripe.webhooks.constructEvent(
    Buffer.from(body),
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "product.created":
    case "product.updated":
      upsertCachedProduct(event.data.object);
      break;
    case "product.deleted":
      deleteCachedProduct(event.data.object.id);
      break;
    case "price.created":
    case "price.updated":
      upsertCachedPrice(event.data.object);
      break;
    case "price.deleted":
      deleteCachedPrice(event.data.object.id);
      break;
    case "payment_link.created":
    case "payment_link.updated":
      void refreshProducts();
      break;
    case "checkout.session.completed":
      setCustomerSubscription(event.data.object);
      break;
  }

  return new Response("OK", { status: 200 });
};
