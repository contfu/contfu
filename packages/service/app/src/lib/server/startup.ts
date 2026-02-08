import { WSServer } from "@contfu/svc-backend/infra/ws/ws-server";
import { StreamServer } from "@contfu/svc-backend/infra/stream/stream-server";
import { SyncWorkerManager } from "@contfu/svc-backend/infra/sync-worker/worker-manager";

// Singleton instances - lazily initialized
let wsServer: WSServer | null = null;
let streamServer: StreamServer | null = null;
let workerManager: SyncWorkerManager | null = null;
let isInitialized = false;

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
 * Gets the StreamServer singleton instance.
 * Creates it lazily on first access.
 */
export function getStreamServer(): StreamServer {
  if (!streamServer) {
    streamServer = new StreamServer();
  }
  return streamServer;
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
 * Initializes the transport servers and SyncWorkerManager.
 * This should be called once at server startup.
 *
 * - Starts the sync worker
 * - Wires the worker to transport servers for broadcasting items
 */
export async function initialize(): Promise<void> {
  if (isInitialized) {
    console.warn("Server startup already initialized");
    return;
  }

  const wss = getWSServer();
  const stream = getStreamServer();
  const worker = getSyncWorkerManager();

  // Wire the worker to all transport servers
  wss.setWorker(worker);
  stream.setWorker(worker);

  // Wire the onItems callback to broadcast items to all connected clients
  worker.onItems((items, connections) => {
    wss.broadcast(items, connections);
    stream.broadcast(items, connections);
  });

  // Start the worker
  await worker.start();

  isInitialized = true;
  console.log("Server startup complete: WebSocket, Stream, and SyncWorkerManager initialized");
}

/**
 * Gracefully shuts down the transport servers and SyncWorkerManager.
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
  wsServer = null;
  streamServer = null;
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
