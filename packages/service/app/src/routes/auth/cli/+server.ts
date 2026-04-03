import { auth } from "$lib/server/auth";
import { storeCliToken } from "$lib/server/cli-token-store";
import { db } from "@contfu/svc-backend/infra/db/db";
import { apikeyTable } from "@contfu/svc-backend/infra/db/schema";
import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  const callback = url.searchParams.get("callback");
  const state = url.searchParams.get("state");
  const mode = url.searchParams.get("mode");

  const isCodeMode = mode === "code";

  if (!isCodeMode && (!callback || !state)) {
    return new Response("Missing callback or state parameter", { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    const next = `/auth/cli?${url.searchParams.toString()}`;
    throw redirect(302, `/login?next=${encodeURIComponent(next)}`);
  }

  const keyName = `CLI - ${hostname()}`;

  // Delete any existing CLI key for this hostname to avoid stale keys.
  // Use a direct DB query instead of auth.api.listApiKeys() to avoid plugin-level
  // issues with the referenceId field resolution.
  const existingKeys = await db
    .select()
    .from(apikeyTable)
    .where(eq(apikeyTable.referenceId, String(session.user.id)));
  for (const key of existingKeys) {
    if (key.name === keyName) {
      await auth.api.deleteApiKey({ body: { keyId: String(key.id) }, headers: request.headers });
    }
  }

  // Must call without headers/request so better-auth treats this as a server-side
  // invocation — passing headers makes it an "authRequired" context which rejects
  // server-only fields like `permissions`.
  const result = await auth.api.createApiKey({
    body: {
      name: keyName,
      userId: String(session.user.id),
      permissions: { api: ["read", "write"] },
      rateLimitEnabled: true,
      rateLimitMax: 60,
      rateLimitTimeWindow: 60 * 1000,
    },
  });

  if (!result?.key) {
    return new Response("Failed to create API key", { status: 500 });
  }

  if (isCodeMode) {
    const code = randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F2B1C9"
    storeCliToken(code, result.key);
    throw redirect(302, `/auth/cli/success?code=${code}`);
  }

  const callbackUrl = new URL(callback!);
  if (callbackUrl.hostname !== "localhost" && callbackUrl.hostname !== "127.0.0.1") {
    return new Response("Callback must be a localhost URL", { status: 400 });
  }
  callbackUrl.searchParams.set("token", result.key);
  callbackUrl.searchParams.set("state", state!);

  throw redirect(302, callbackUrl.toString());
};
