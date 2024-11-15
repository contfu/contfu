import type { RequestHandler } from "@builder.io/qwik-city";
import { buffer } from "stream/consumers";
import { setCustomerSubscription } from "~/server/stripe/customers";
import {
  deleteCachedPrice,
  deleteCachedProduct,
  refreshProducts,
  upsertCachedPrice,
  upsertCachedProduct,
} from "~/server/stripe/products";
import { getStripe } from "~/server/stripe/stripe";

export const onPost: RequestHandler = async ({ request, send, error, env }) => {
  const sig = request.headers.get("stripe-signature");
  if (!sig) throw error(400, "No signature");
  if (!request.body) throw error(400, "No body");
  const body = await buffer(request.body as any);

  const event = (await getStripe()).webhooks.constructEvent(
    body,
    sig,
    env.get("STRIPE_WEBHOOK_SECRET")!,
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
  send(200, "OK");
};
