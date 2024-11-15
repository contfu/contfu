import type Stripe from "stripe";
import { getStripe } from "./stripe";

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

let stripeProducts: Promise<Product[]> | undefined;

export function getStripeProducts() {
  return (stripeProducts ??= reloadProducts());
}

export async function upsertCachedProduct(product: Stripe.Product) {
  const cachedProduct = (await getStripeProducts()).find(
    (p) => p.id === product.id,
  );
  if (!cachedProduct) return (stripeProducts = reloadProducts());
  Object.assign(cachedProduct, mapProduct(product));
}

export async function deleteCachedProduct(productId: string) {
  const index = (await getStripeProducts()).findIndex(
    (p) => p.id === productId,
  );
  if (index === -1) return;
  (await getStripeProducts()).splice(index, 1);
}

export async function upsertCachedPrice(price: Stripe.Price) {
  const stripe = await getStripe();
  const cachedProduct = (await getStripeProducts()).find((p) => {
    return p.id === price.product;
  });
  if (!cachedProduct) return refreshProducts();
  const cachedPrice =
    cachedProduct.prices[
      price.recurring?.interval === "year" ? "yearly" : "monthly"
    ];
  if (!cachedPrice) {
    const { data: links } = await stripe.paymentLinks.list({
      active: true,
      expand: ["data.line_items"],
    });
    const link = links.find((l) =>
      l.line_items!.data.some((li) => li.price?.id === price.id),
    );
    if (!link) return;
    cachedProduct.prices[
      price.recurring?.interval === "year" ? "yearly" : "monthly"
    ] = mapPrice(price, link);
    return;
  }
  cachedPrice.amount = price.unit_amount! / 100;
  cachedPrice.currency = price.currency;
}

export async function deleteCachedPrice(priceId: string) {
  const cachedProduct = (await getStripeProducts()).find(
    (p) => p.prices.yearly?.id === priceId || p.prices.monthly?.id === priceId,
  );
  if (!cachedProduct) return;
  if (cachedProduct.prices.yearly?.id === priceId)
    delete cachedProduct.prices.yearly;
  if (cachedProduct.prices.monthly?.id === priceId)
    delete cachedProduct.prices.monthly;
}

export async function refreshProducts() {
  stripeProducts = reloadProducts();
  await stripeProducts;
}

async function reloadProducts() {
  const stripe = await getStripe();
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
    ] = mapPrice(price, link);
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

function mapPrice(price: Stripe.Price, link: Stripe.PaymentLink) {
  return {
    id: price.id,
    url: link.url,
    amount: price.unit_amount! / 100,
    currency: price.currency,
  };
}
