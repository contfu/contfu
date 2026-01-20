import { db } from "$lib/server/db/db";
import * as schema from "$lib/server/db/schema";
import { checkout, polar, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.POLAR_SANDBOX === "true" ? "sandbox" : "production",
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "e3d96e4b-2c14-4b90-b56e-7efed5d16b83",
              slug: "business/monthly",
            },
            {
              productId: "4ec0456a-0981-4611-8532-31cc94ac3e87",
              slug: "business/yearly",
            },
            {
              productId: "c36e30b0-a654-4c39-9b8d-049be7dfd49a",
              slug: "pro/monthly",
            },
            {
              productId: "58148e9c-5025-4b4a-9255-fa8b47be98ce",
              slug: "pro/yearly",
            },
            {
              productId: "bebd5fad-e647-47db-9052-3167f81f14d3",
              slug: "starter/monthly",
            },
            {
              productId: "9f177026-9631-4f1d-a22c-9f3f616589e2",
              slug: "starter/yearly",
            },
          ],
          successUrl: "/success?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        ...(process.env.POLAR_WEBHOOK_SECRET
          ? [
              webhooks({
                secret: process.env.POLAR_WEBHOOK_SECRET,
                onCustomerStateChanged: async (payload) => {},
                onOrderPaid: async (payload) => {},
                onPayload: async (payload) => {},
              }),
            ]
          : []),
      ],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
