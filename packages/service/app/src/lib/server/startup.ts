import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { ensureEventStream } from "@contfu/svc-backend/infra/nats/event-stream";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import { StreamServer } from "@contfu/svc-backend/infra/stream/stream-server";
import { SyncWorkerManager } from "@contfu/svc-backend/infra/sync-worker/worker-manager";
import {
  ensureWebhookFetchQueue,
  startWebhookFetchWorker,
  stopWebhookFetchWorker,
} from "@contfu/svc-backend/infra/webhook-queue/index";

const log = createLogger("startup");

// Singleton instances - lazily initialized
let streamServer: StreamServer | null = null;
let workerManager: SyncWorkerManager | null = null;
let isInitialized = false;

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
 * Initializes the stream server and SyncWorkerManager.
 * This should be called once at server startup.
 *
 * - Starts the sync worker
 * - Wires the worker to stream server for broadcasting items
 */
export async function initialize(): Promise<void> {
  if (isInitialized) {
    log.warn("Server startup already initialized");
    return;
  }

  const stream = getStreamServer();
  const worker = getSyncWorkerManager();

  log.info(
    { nats: hasNats(), natsServer: process.env.NATS_SERVER ?? null },
    "Infrastructure status",
  );

  // Initialize JetStream event stream if NATS is available
  if (hasNats()) {
    await ensureEventStream();
    await ensureWebhookFetchQueue();
    startWebhookFetchWorker({ streamServer: stream });
  }

  // Wire the onItems callback to broadcast items to all connected clients
  worker.onItems((items, connections) => {
    stream.broadcast(items, connections);
  });

  // Start the worker
  await worker.start();

  isInitialized = true;
  log.info("Server startup complete: StreamServer and SyncWorkerManager initialized");
}

/**
 * Gracefully shuts down the stream server and SyncWorkerManager.
 * This should be called on server shutdown.
 */
export async function shutdown(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  log.info("Shutting down server startup services...");

  // Stop the worker manager
  if (workerManager) {
    await workerManager.stop();
  }

  if (hasNats()) {
    await stopWebhookFetchWorker();
  }

  // Clear singletons
  streamServer = null;
  workerManager = null;
  isInitialized = false;

  log.info("Server startup services shut down");
}

/**
 * Returns whether the server startup has been initialized.
 */
export function isServerInitialized(): boolean {
  return isInitialized;
}
