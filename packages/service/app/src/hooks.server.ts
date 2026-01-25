import { building, dev } from "$app/environment";
import { auth } from "$lib/server/auth/auth";
import { initialize, shutdown } from "$lib/server/startup";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

// Re-export WebSocket handler for svelte-adapter-bun
export { websocket } from "./websocket";

// Initialize WebSocket server and SyncWorkerManager at startup
// Skip during SSR build phase
if (!building) {
  // In dev mode (Vite), start a standalone WebSocket server on port 8012
  // because Vite doesn't support Bun's WebSocket infrastructure
  initialize(dev).catch((error) => {
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
  const { request } = event;
  const url = new URL(request.url);

  const platform = event.platform as any;
  const server = platform?.server;
  // Check for WebSocket upgrade request (production only - svelte-adapter-bun)
  // In dev mode, WebSocket connections go to the standalone server on port 8012
  if (
    server &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade") &&
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    url.pathname.startsWith("/ws")
  ) {
    const upgraded = server.upgrade(platform.request);
    if (upgraded) {
      // Connection upgraded successfully - return 101 to signal SvelteKit
      return new Response(null, { status: 101 });
    }
    return new Response("WebSocket upgrade failed", { status: 400 });
  }
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;
  return svelteKitHandler({ event, resolve, auth, building });
};
