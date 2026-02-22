import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { initialize, shutdown } from "$lib/server/startup";
import { withUserDbContext } from "@contfu/svc-backend/infra/db/db";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

const log = createLogger("hooks");

// Initialize stream server and SyncWorkerManager at startup
// Skip during SSR build phase
if (!building) {
  initialize().catch((error) => {
    log.error({ err: error }, "Failed to initialize server startup services");
  });

  // Register shutdown handler for graceful cleanup
  process.on("SIGTERM", () => {
    void shutdown();
  });

  process.on("SIGINT", () => {
    void shutdown();
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;
  if (event.locals.user) {
    return withUserDbContext(Number(event.locals.user.id), async () =>
      svelteKitHandler({ event, resolve, auth, building }),
    );
  }
  return svelteKitHandler({ event, resolve, auth, building });
};
