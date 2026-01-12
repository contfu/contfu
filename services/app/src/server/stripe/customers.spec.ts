import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db, quotaTable, userTable } from "~/db/db";
import { stripeMock } from "../../../test/mocks";
import {
  checkoutSessionFixture,
  subscriptionRetrieveFixture,
} from "./__fixtures__/stripe-fixtures";
import { setCustomerSubscription } from "./customers";

beforeEach(() => {});

describe("setCustomerSubscription()", () => {
  it("should create a new user and add quota", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      subscriptionRetrieveFixture,
    );

    await setCustomerSubscription(checkoutSessionFixture);

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith(
      checkoutSessionFixture.subscription as string,
    );
    const user = await db.query.user.findFirst({
      where: eq(
        userTable.email,
        checkoutSessionFixture.customer_details!.email!,
      ),
    });
    expect(user).toEqual(
      expect.objectContaining({
        email: checkoutSessionFixture.customer_details!.email!,
        name: checkoutSessionFixture.customer_details!.name!,
        activeUntil: subscriptionRetrieveFixture.current_period_end,
      }),
    );
    expect(
      await db.query.quota.findFirst({
        where: eq(quotaTable.id, user!.id),
      }),
    ).toEqual({
      id: user!.id,
      sources: 0,
      collections: 0,
      items: 0,
      consumers: 0,
      maxSources: 1,
      maxCollections: 10,
      maxItems: 1000,
      maxConsumers: 3,
    });
  });
});
