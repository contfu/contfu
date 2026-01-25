import { WebSocketServer } from "./websocket/ws-server";
import { SyncWorkerManager } from "./sync-worker/worker-manager";

// Singleton instances - lazily initialized
let wsServer: WebSocketServer | null = null;
let workerManager: SyncWorkerManager | null = null;
let isInitialized = false;
let devServer: ReturnType<typeof Bun.serve> | null = null;

// Development WebSocket server port (used when running with Vite dev server)
const DEV_WS_PORT = parseInt(process.env.WS_PORT || "8012", 10);

/**
 * Gets the WebSocketServer singleton instance.
 * Creates it lazily on first access.
 */
export function getWebSocketServer(): WebSocketServer {
  if (!wsServer) {
    wsServer = new WebSocketServer();
  }
  return wsServer;
}

/**
 * Gets the SyncWorkerManager singleton instance.
 * Creates it lazily on first access.
 */
export function getSyncWorkerManager(): SyncWorkerManager {
  if (!workerManager) {
    workerManager = new SyncWorkerManager();
  }
  return workerManager;
}

/**
 * Initializes the WebSocket server and SyncWorkerManager.
 * This should be called once at server startup.
 *
 * - Starts the sync worker
 * - Wires the worker to the WebSocket server for broadcasting items
 * - In development mode, starts a standalone WebSocket server
 *
 * @param isDev - Whether running in development mode (Vite). In dev mode,
 *                a standalone WebSocket server is started on WS_PORT (default 8012).
 */
export async function initialize(isDev = false): Promise<void> {
  if (isInitialized) {
    console.warn("Server startup already initialized");
    return;
  }

  const ws = getWebSocketServer();
  const worker = getSyncWorkerManager();

  // Wire the worker to the WebSocket server
  ws.setWorker(worker);

  // Wire the onItems callback to broadcast items to connected clients
  worker.onItems((items, connections) => {
    ws.broadcast(items, connections);
  });

  // Start the worker
  await worker.start();

  // In development mode, start a standalone WebSocket server
  // because Vite's dev server doesn't support Bun's WebSocket infrastructure
  if (isDev) {
    await startDevWebSocketServer();
  }

  isInitialized = true;
  console.log("Server startup complete: WebSocket server and SyncWorkerManager initialized");
}

/**
 * Starts a standalone WebSocket server for development mode.
 * This is needed because Vite's dev server doesn't support Bun's WebSocket infrastructure.
 * The server listens on WS_PORT (default 8012) and handles WebSocket upgrades.
 */
async function startDevWebSocketServer(): Promise<void> {
  if (devServer) {
    console.warn("Dev WebSocket server already running");
    return;
  }

  const handler = getWebSocketHandler();

  devServer = Bun.serve({
    port: DEV_WS_PORT,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/ws" || url.pathname === "/") {
        if (server.upgrade(request, { data: { id: "" } })) {
          return undefined as unknown as Response;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: handler,
  });

  console.log(`Development WebSocket server listening on ws://localhost:${DEV_WS_PORT}/ws`);
}

/**
 * Gracefully shuts down the WebSocket server and SyncWorkerManager.
 * This should be called on server shutdown.
 */
export async function shutdown(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  console.log("Shutting down server startup services...");

  // Stop the dev WebSocket server if running
  if (devServer) {
    devServer.stop(true);
    devServer = null;
    console.log("Development WebSocket server stopped");
  }

  // Stop the worker manager
  if (workerManager) {
    await workerManager.stop();
  }

  // Clear singletons
  wsServer = null;
  workerManager = null;
  isInitialized = false;

  console.log("Server startup services shut down");
}

/**
 * Gets the WebSocket handler configuration for Bun.serve().
 * This returns the handler from the WebSocketServer singleton.
 */
export function getWebSocketHandler() {
  return getWebSocketServer().createHandler();
}

/**
 * Returns whether the server startup has been initialized.
 */
export function isServerInitialized(): boolean {
  return isInitialized;
}
