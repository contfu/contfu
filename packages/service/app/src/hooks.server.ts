import { building } from "$app/environment";
import { auth } from "@contfu/svc-backend/infra/auth/auth";
import { initialize, shutdown } from "$lib/server/startup";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

// Initialize SSE server and SyncWorkerManager at startup
// Skip during SSR build phase
if (!building) {
  initialize().catch((error) => {
    console.error("Failed to initialize server startup services:", error);
  });

  // Register shutdown handler for graceful cleanup
  process.on("SIGTERM", async () => {
    await shutdown();
  });

  process.on("SIGINT", async () => {
    await shutdown();
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;
  return svelteKitHandler({ event, resolve, auth, building });
};
