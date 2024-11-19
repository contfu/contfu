import { mock } from "bun:test";
import type Stripe from "stripe";

export const stripeMock = {
  products: {
    list: mock(
      async () =>
        ({ data: [] }) as unknown as Stripe.ApiListPromise<Stripe.Product>,
    ),
  },
  paymentLinks: {
    list: mock(
      async () =>
        ({ data: [] }) as unknown as Stripe.ApiListPromise<Stripe.PaymentLink>,
    ),
  },
  subscriptions: { retrieve: mock() },
  webhooks: { constructEvent: mock() },
};
