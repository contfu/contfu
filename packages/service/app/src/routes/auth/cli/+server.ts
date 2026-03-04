import { auth } from "$lib/server/auth";
import { storeCliToken } from "$lib/server/cli-token-store";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { hostname } from "node:os";
import { randomBytes } from "node:crypto";

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

  // Delete any existing CLI key for this hostname to avoid stale keys
  const existing = await auth.api.listApiKeys({ headers: request.headers });
  for (const key of existing) {
    if (key.name === keyName) {
      await auth.api.deleteApiKey({ body: { keyId: key.id }, headers: request.headers });
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
