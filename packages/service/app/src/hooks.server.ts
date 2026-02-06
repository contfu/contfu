import { building, dev } from "$app/environment";
import { auth } from "@contfu/svc-backend/infra/auth/auth";
import { initialize, shutdown, getWSServer } from "$lib/server/startup";
import type { WSData } from "@contfu/svc-backend/infra/ws/ws-server";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

// Initialize SSE server and SyncWorkerManager at startup
// Skip during SSR build phase
if (!building) {
  initialize().catch((error) => {
    console.error("Failed to initialize server startup services:", error);
  });

  // In dev mode, start standalone WebSocket server (Vite proxies to it)
  // In production, svelte-adapter-bun handles WS via the websocket export below
  if (dev) {
    import("$lib/server/ws-dev-server").then((m) => m.startWSDevServer()).catch(console.error);
  }

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

  // Check for WebSocket upgrade request on /api/ws (production only)
  // In dev mode, Vite proxies /api/ws to the standalone WS server (port 5174)
  if (
    !dev &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade") &&
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    url.pathname === "/api/ws"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const platform = event.platform as { server?: any; request?: Request };
    if (!platform?.server || !platform?.request) {
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Authenticate using headers before upgrade
    const wsServer = getWSServer();
    const authResult = await wsServer.authenticateUpgrade(request);
    
    if (!authResult.success) {
      return new Response(authResult.message, { status: authResult.status });
    }

    // Upgrade the connection with authenticated data
    platform.server.upgrade(platform.request, {
      data: authResult.data,
      // Echo back the subprotocol if used (required for browser WebSocket)
      headers: authResult.protocol
        ? { "Sec-WebSocket-Protocol": authResult.protocol }
        : undefined,
    });
    return new Response(null, { status: 101 });
  }

  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;
  return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * WebSocket handler for Bun.
 * Delegates to the WSServer singleton for connection/message handling.
 */
export const websocket: Bun.WebSocketHandler<WSData> = {
  open(ws) {
    const server = getWSServer();
    server.handleOpen(ws);
  },
  async message(ws, message) {
    const server = getWSServer();
    await server.handleMessage(ws, message);
  },
  close(ws) {
    const server = getWSServer();
    server.handleClose(ws);
  },
};
