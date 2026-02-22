import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { getRuntime } from "$lib/server/effect-runtime";
import { initialize, shutdown } from "$lib/server/startup";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

const log = createLogger("hooks");

// Initialize at startup. Skip during SSR build phase.
if (!building) {
  // Initialize legacy startup services (StreamServer, SyncWorkerManager, NATS)
  initialize().catch((error) => {
    log.error({ err: error }, "Failed to initialize server startup services");
  });

  // Register shutdown handlers for graceful cleanup
  process.on("SIGTERM", () => {
    void shutdown();
    void getRuntime().dispose();
  });

  process.on("SIGINT", () => {
    void shutdown();
    void getRuntime().dispose();
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;
  return svelteKitHandler({ event, resolve, auth, building });
};
