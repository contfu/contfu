import { SSEServer } from "@contfu/svc-backend/infra/sse/sse-server";
import { WSServer } from "@contfu/svc-backend/infra/ws/ws-server";
import { SyncWorkerManager } from "@contfu/svc-backend/infra/sync-worker/worker-manager";

// Singleton instances - lazily initialized
let sseServer: SSEServer | null = null;
let wsServer: WSServer | null = null;
let workerManager: SyncWorkerManager | null = null;
let isInitialized = false;

/**
 * Gets the SSEServer singleton instance.
 * Creates it lazily on first access.
 */
export function getSSEServer(): SSEServer {
  if (!sseServer) {
    sseServer = new SSEServer();
  }
  return sseServer;
}

/**
 * Gets the WSServer singleton instance.
 * Creates it lazily on first access.
 */
export function getWSServer(): WSServer {
  if (!wsServer) {
    wsServer = new WSServer();
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
 * Initializes the SSE server and SyncWorkerManager.
 * This should be called once at server startup.
 *
 * - Starts the sync worker
 * - Wires the worker to the SSE server for broadcasting items
 */
export async function initialize(): Promise<void> {
  if (isInitialized) {
    console.warn("Server startup already initialized");
    return;
  }

  const sse = getSSEServer();
  const wss = getWSServer();
  const worker = getSyncWorkerManager();

  // Wire the worker to both SSE and WebSocket servers
  sse.setWorker(worker);
  wss.setWorker(worker);

  // Wire the onItems callback to broadcast items to connected clients
  worker.onItems((items, connections) => {
    sse.broadcast(items, connections);
    wss.broadcast(items, connections);
  });

  // Start the worker
  await worker.start();

  isInitialized = true;
  console.log("Server startup complete: SSE, WebSocket, and SyncWorkerManager initialized");
}

/**
 * Gracefully shuts down the SSE server and SyncWorkerManager.
 * This should be called on server shutdown.
 */
export async function shutdown(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  console.log("Shutting down server startup services...");

  // Stop the worker manager
  if (workerManager) {
    await workerManager.stop();
  }

  // Clear singletons
  sseServer = null;
  wsServer = null;
  workerManager = null;
  isInitialized = false;

  console.log("Server startup services shut down");
}

/**
 * Returns whether the server startup has been initialized.
 */
export function isServerInitialized(): boolean {
  return isInitialized;
}
