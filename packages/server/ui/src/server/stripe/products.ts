import type Stripe from "stripe";
import { stripe } from "./stripe";

type Price = {
  id: string;
  url: string;
  amount: number;
  currency: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  features: string[];
  hidden: boolean;
  quota: {
    maxSources: number;
    maxCollections: number;
    maxItems: number;
    maxConsumers: number;
  };
  prices: { yearly?: Price; monthly?: Price };
};

export let stripeProducts: Promise<Product[]> = getProducts();

export async function upsertCachedProduct(product: Stripe.Product) {
  const cachedProduct = (await stripeProducts).find((p) => p.id === product.id);
  if (!cachedProduct) return (stripeProducts = getProducts());
  Object.assign(cachedProduct, mapProduct(product));
}

export async function deleteCachedProduct(productId: string) {
  const index = (await stripeProducts).findIndex((p) => p.id === productId);
  if (index === -1) return;
  (await stripeProducts).splice(index, 1);
}

export async function upsertCachedPrice(plan: Stripe.Price) {
  const cachedProduct = (await stripeProducts).find(
    (p) => p.id === plan.product,
  );
  if (!cachedProduct) return (stripeProducts = getProducts());
  const cachedPlan =
    cachedProduct.prices[
      plan.recurring?.interval === "year" ? "yearly" : "monthly"
    ];
  if (!cachedPlan) return (stripeProducts = getProducts());
  cachedPlan.amount = plan.unit_amount! / 100;
  cachedPlan.currency = plan.currency;
}

export async function deleteCachedPrice(priceId: string) {
  const cachedProduct = (await stripeProducts).find(
    (p) => p.prices.yearly?.id === priceId || p.prices.monthly?.id === priceId,
  );
  if (!cachedProduct) return;
  if (cachedProduct.prices.yearly?.id === priceId)
    delete cachedProduct.prices.yearly;
  if (cachedProduct.prices.monthly?.id === priceId)
    delete cachedProduct.prices.monthly;
}

export function refreshProducts() {
  stripeProducts = getProducts();
}

async function getProducts() {
  const [{ data: prods }, { data: links }] = await Promise.all([
    stripe.products.list({ active: true }),
    stripe.paymentLinks.list({ active: true, expand: ["data.line_items"] }),
  ]);
  const products = prods.map(
    (p) => ({ ...mapProduct(p), prices: {} }) as Product,
  );

  for (const link of links) {
    const price = link.line_items!.data[0].price!;
    const product = products.find((p) => p.id === price.product);
    if (!product) continue;
    product.prices[
      price.recurring?.interval === "year" ? "yearly" : "monthly"
    ] = {
      id: price.id,
      url: link.url,
      amount: price.unit_amount! / 100,
      currency: price.currency,
    };
  }

  return products
    .filter((p) => p.prices.yearly || p.prices.monthly)
    .sort(
      (a, b) =>
        (a.prices.yearly?.amount ?? a.prices.monthly!.amount * 12) -
        (b.prices.yearly?.amount ?? b.prices.monthly!.amount * 12),
    );
}

function mapProduct(product: Stripe.Product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description!,
    recommended: product.metadata.recommended === "true",
    features: product.marketing_features.map((f) => f.name!).filter(Boolean),
    hidden: product.metadata.hidden === "true",
    quota: {
      maxSources: Number(product.metadata.maxSources),
      maxCollections: Number(product.metadata.maxCollections),
      maxItems: Number(product.metadata.maxItems),
      maxConsumers: Number(product.metadata.maxConsumers),
    },
  };
}
