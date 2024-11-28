import { beforeEach, describe, expect, it } from "bun:test";
import { stripeMock } from "../../../test/mocks";
import {
  listLinksFixture,
  listProductsFixture,
} from "./__fixtures__/stripe-fixtures";
import {
  deleteCachedPrice,
  deleteCachedProduct,
  getStripeProducts,
  refreshProducts,
  upsertCachedPrice,
  upsertCachedProduct,
} from "./products";

beforeEach(() => {
  stripeMock.products.list.mockResolvedValue(listProductsFixture);
  stripeMock.paymentLinks.list.mockResolvedValue(listLinksFixture);
});

describe("refreshProducts()", () => {
  it("should refresh the products", async () => {
    await refreshProducts();

    expect(await getStripeProducts()).toMatchSnapshot();
  });
});

describe("upsertCachedProduct()", () => {
  it("should upsert the product", async () => {
    await getStripeProducts();

    upsertCachedProduct({
      ...listProductsFixture.data[0],
      name: "Upserted Name",
    });

    expect(
      (await getStripeProducts()).find((p) => p.name === "Upserted Name")?.name,
    ).toBeDefined();
  });
});

describe("deleteCachedProduct()", () => {
  it("should delete the product", async () => {
    await getStripeProducts();

    deleteCachedProduct(listProductsFixture.data[0].id);

    expect(await getStripeProducts()).not.toContainEqual(
      listProductsFixture.data[0],
    );
  });
});

const price = listLinksFixture.data[0].line_items!.data[0].price!;

describe("upsertCachedPrice()", () => {
  it("should upsert the price", async () => {
    await refreshProducts();
    stripeMock.products.list.mockClear();

    await upsertCachedPrice({
      ...price,
      unit_amount: 1000,
    });

    expect(
      (await getStripeProducts()).find((p) => p.id === price.product)?.prices
        .yearly?.amount,
    ).toBe(10);
    expect(stripeMock.products.list).not.toHaveBeenCalled();
  });

  it("should reload the products if the product is not found", async () => {
    stripeMock.products.list.mockClear();

    await upsertCachedPrice({
      ...price,
      product: "non-existent-product",
    });

    expect(stripeMock.products.list).toHaveBeenCalledTimes(1);
    expect(await getStripeProducts()).toHaveLength(3);
  });

  it("should add the price if it is not found", async () => {
    await refreshProducts();
    stripeMock.products.list.mockClear();
    stripeMock.paymentLinks.list.mockClear();
    const product = (await getStripeProducts()).find(
      (p) => p.id === price.product,
    )!;
    delete product.prices.yearly;

    await upsertCachedPrice({
      ...price,
    });

    expect(stripeMock.paymentLinks.list).toHaveBeenCalledTimes(1);
    expect(stripeMock.products.list).not.toHaveBeenCalled();
    expect(product.prices.yearly!.id).toEqual(price.id);
  });
});

describe("deleteCachedPrice()", () => {
  it("should delete a yearly price", async () => {
    await refreshProducts();
    const price = (await getStripeProducts())[0].prices.yearly!;
    stripeMock.products.list.mockClear();
    expect(price).toBeDefined();

    await deleteCachedPrice(price.id);

    expect((await getStripeProducts())[0].prices.yearly).toBeUndefined();
  });

  it("should delete a monthly price", async () => {
    await refreshProducts();
    const price = (await getStripeProducts())[0].prices.monthly!;
    stripeMock.products.list.mockClear();
    expect(price).toBeDefined();

    await deleteCachedPrice(price.id);

    expect((await getStripeProducts())[0].prices.monthly).toBeUndefined();
  });
});
