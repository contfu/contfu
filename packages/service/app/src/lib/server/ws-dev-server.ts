/**
 * Standalone WebSocket server for development.
 *
 * In dev mode, Vite doesn't support WebSocket upgrades, so we run
 * a separate Bun server on port 5174 that handles WebSocket connections.
 *
 * Vite proxies /api/ws to this server.
 *
 * In production (svelte-adapter-bun), WebSocket is handled by the main
 * server via the `websocket` export in hooks.server.ts.
 */
import type { WSData } from "@contfu/svc-backend/infra/ws/ws-server";
import { getWSServer, initialize } from "./startup";

const WS_DEV_PORT = 5174;

let server: ReturnType<typeof Bun.serve> | null = null;

export async function startWSDevServer() {
  if (server) {
    console.log("[WS Dev] Server already running");
    return;
  }

  // Ensure the WSServer and worker are initialized
  await initialize();

  const wsServer = getWSServer();

  server = Bun.serve<WSData>({
    port: WS_DEV_PORT,

    async fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade
      if (url.pathname === "/api/ws") {
        // Authenticate using headers before upgrade
        const authResult = await wsServer.authenticateUpgrade(req);

        if (!authResult.success) {
          return new Response(authResult.message, { status: authResult.status });
        }

        const success = server.upgrade(req, {
          data: authResult.data,
          // Echo back the subprotocol if used (required for browser WebSocket)
          headers: authResult.protocol
            ? { "Sec-WebSocket-Protocol": authResult.protocol }
            : undefined,
        });

        if (success) {
          return undefined; // Upgrade successful
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      // Health check endpoint
      if (url.pathname === "/health") {
        return new Response("OK", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws) {
        wsServer.handleOpen(ws);
      },
      async message(ws, message) {
        await wsServer.handleMessage(ws, message);
      },
      close(ws) {
        wsServer.handleClose(ws);
      },
    },
  });

  console.log(`[WS Dev] WebSocket server running on ws://localhost:${WS_DEV_PORT}/api/ws`);
}

export function stopWSDevServer() {
  if (server) {
    server.stop();
    server = null;
    console.log("[WS Dev] Server stopped");
  }
}

// Auto-start when imported in dev mode
if (process.env.NODE_ENV !== "production") {
  startWSDevServer().catch(console.error);
}
