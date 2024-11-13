import type Stripe from "stripe";
import { stripe } from "./stripe";

type Plan = {
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
  plans: { yearly?: Plan; monthly?: Plan };
};

export let stripeProducts: Promise<Product[]> = getProducts();

export async function upsertCachedProduct(product: Stripe.Product) {
  const cachedProduct = (await stripeProducts).find((p) => p.id === product.id);
  if (!cachedProduct) return (stripeProducts = getProducts());
  Object.assign(cachedProduct, mapProduct(product));
}

export async function upsertCachedPlan(plan: Stripe.Price) {
  const cachedProduct = (await stripeProducts).find(
    (p) => p.id === plan.product,
  );
  if (!cachedProduct) return (stripeProducts = getProducts());
  const cachedPlan =
    cachedProduct.plans[
      plan.recurring?.interval === "year" ? "yearly" : "monthly"
    ];
  if (!cachedPlan) return (stripeProducts = getProducts());
  cachedPlan.amount = plan.unit_amount! / 100;
  cachedPlan.currency = plan.currency;
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
    (p) => ({ ...mapProduct(p), plans: {} }) as Product,
  );

  for (const link of links) {
    const price = link.line_items!.data[0].price!;
    const product = products.find((p) => p.id === price.product);
    if (!product) continue;
    product.plans[price.recurring?.interval === "year" ? "yearly" : "monthly"] =
      {
        id: price.id,
        url: link.url,
        amount: price.unit_amount! / 100,
        currency: price.currency,
      };
  }

  return products
    .filter((p) => p.plans.yearly || p.plans.monthly)
    .sort(
      (a, b) =>
        (a.plans.yearly?.amount ?? a.plans.monthly!.amount * 12) -
        (b.plans.yearly?.amount ?? b.plans.monthly!.amount * 12),
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
