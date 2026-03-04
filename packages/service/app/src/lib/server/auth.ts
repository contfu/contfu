import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { UserRole } from "@contfu/svc-backend/domain/types";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { createNatsKvSessionStorage } from "@contfu/svc-backend/infra/auth/secondary-storage";
import { db } from "@contfu/svc-backend/infra/db/db";
import * as schema from "@contfu/svc-backend/infra/db/schema";
import { sendEmail } from "@contfu/svc-backend/infra/mail/mail";
import { absolute, button, link } from "@contfu/svc-backend/infra/mail/mail-rendering";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import { checkout, polar, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { apiKey } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { count } from "drizzle-orm";

const log = createLogger("auth");

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.POLAR_SANDBOX === "true" ? "sandbox" : "production",
});

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.ORIGIN ?? "http://localhost:8011",
  basePath: "/api/auth",
  trustedOrigins: [
    process.env.ORIGIN ?? "http://localhost:8011",
    ...(dev ? ["http://localhost:4173"] : []),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
      apikey: schema.apikeyTable,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "number",
        required: false,
        defaultValue: UserRole.USER,
        input: false,
      },
      approved: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google", "notion"],
      allowDifferentEmails: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          // Check if this is the first user (will be admin)
          const [{ userCount }] = await db.select({ userCount: count() }).from(schema.userTable);

          const isFirstUser = userCount === 0;

          return {
            data: {
              ...user,
              role: isFirstUser ? UserRole.ADMIN : UserRole.USER,
              approved: isFirstUser, // First user is auto-approved
            },
          };
        },
      },
    },
  },
  advanced: {
    database: {
      useNumberId: true,
    },
    cookies: {
      session_token: { name: "s" },
      session_data: { name: "d" },
      dont_remember: { name: "n" },
    },
  },
  secondaryStorage: hasNats() ? await createNatsKvSessionStorage() : undefined,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, token }) => {
      await sendEmail(
        user.email,
        "Reset your password",
        `
        <h1>Reset your password</h1>
        <p>Hello ${user.name},</p>
        <p>Click the button below to reset your password.</p>
        ${button("reset password", `/reset-password/${token}`)}
        `,
        `Go to ${absolute(`/reset-password/${token}`)} to reset your password`,
      );
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 1 day
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Verify your email",
        `
        <h1>One step pending</h1>
        <p>Welcome ${user.name},</p>
        <p>Thanks for signing up to Pumpit. Please click the button below to verify your email address and get started.</p>
        ${button("complete registration", url)}
        <p>The link will expire in 24 hours. If you did not sign up for Pumpit, you can ignore this email.</p>
        <p>If the link expires, you can sign up again ${link("here", "/login")}.</p>`,
        `Go to ${url} to complete your registration`,
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const ua = ctx.headers?.get("user-agent");
      if (ua) {
        // We only use 3 bytes of hash to identify the user agent.
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(BigInt(Bun.hash.rapidhash(ua)));
        ctx.headers!.set("user-agent", buf.subarray(0, 3).toString("base64url"));
      }
    }),
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
      ? {
          notion: {
            clientId: process.env.NOTION_CLIENT_ID,
            clientSecret: process.env.NOTION_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products:
            process.env.POLAR_SANDBOX === "true"
              ? [
                  {
                    productId: "7194bc4d-3004-4bdd-8548-5142aa401aa0",
                    slug: "business/monthly",
                  },
                  {
                    productId: "36068147-9c98-4e83-a709-4bcd785ca744",
                    slug: "business/yearly",
                  },
                  {
                    productId: "7dfbe6ef-9618-4279-b452-158a09b6c23d",
                    slug: "pro/monthly",
                  },
                  {
                    productId: "89684d11-5a40-44b8-829f-bdb0c5bd88db",
                    slug: "pro/yearly",
                  },
                  {
                    productId: "e11b0672-b758-4496-884e-48fa15b70508",
                    slug: "starter/monthly",
                  },
                  {
                    productId: "9b0e4aeb-8b14-47f6-8c84-7b716b8e4313",
                    slug: "starter/yearly",
                  },
                ]
              : [
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
          returnUrl: "/dashboard",
        }),
        portal(),
        usage(),
        ...(process.env.POLAR_WEBHOOK_SECRET
          ? [
              webhooks({
                secret: process.env.POLAR_WEBHOOK_SECRET,
                onPayload: async (payload) => {
                  log.debug({ payload }, "Polar webhook hook fired");
                },
              }),
            ]
          : []),
      ],
    }),
    apiKey({
      schema: {
        apikey: { modelName: "apikey" },
      },
      permissions: {
        defaultPermissions: { api: ["read", "write"] },
      },
    }),
    sveltekitCookies(getRequestEvent),
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

export async function authenticateApiKey(
  request: Request,
  action: "read" | "write",
): Promise<{ userId: number }> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    error(401, "Missing or invalid Authorization header");
  }

  const key = header.slice(7);
  const result = await auth.api.verifyApiKey({
    body: { key, permissions: { api: [action] } },
  });

  if (!result?.valid) {
    // Better Auth uses code "KEY_NOT_FOUND" for permission mismatches
    if (result?.error?.code === "KEY_NOT_FOUND") {
      error(403, "Insufficient permissions");
    }
    if (result?.error?.code === "RATE_LIMITED") {
      error(429, "Rate limit exceeded");
    }
    error(401, "Invalid API key");
  }

  return { userId: Number(result.key!.userId) };
}
