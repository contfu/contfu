import { EventType, type WireEvent } from "@contfu/core";
import { sql } from "drizzle-orm";
import { db } from "@contfu/svc-backend/infra/db/db";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { verifySmtp } from "@contfu/svc-backend/infra/mail/smtp";
import { ensureEventStream } from "@contfu/svc-backend/infra/nats/event-stream";
import { getNatsConnection } from "@contfu/svc-backend/infra/nats/connection";
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

async function probe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function logStartupDiagnostics(): Promise<void> {
  const diagnostics: Record<string, string> = {};

  diagnostics.postgresql = await probe(() => db.execute(sql`SELECT 1`));
  diagnostics.nats = await probe(() => getNatsConnection());

  if (process.env.SMTP_HOST) {
    diagnostics.smtp = await probe(() => verifySmtp());
  }

  log.info(diagnostics, "Startup diagnostics");
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

  // Fail fast if NATS_SERVER is not configured
  await getNatsConnection();

  await logStartupDiagnostics();

  // Run blob data migrations
  // These handle schema migrations for bytea/JSONB columns that store encoded data
  const { runMsgpackrMigrations } =
    await import("@contfu/svc-backend/infra/db/msgpackr-migrations");

  // Migrations for bytea columns storing MessagePack-encoded data
  // Add new migrations here with incrementing version numbers
  await runMsgpackrMigrations([]);

  // Initialize JetStream event stream and dependent services
  await ensureEventStream();
  await ensureWebhookFetchQueue();
  startWebhookFetchWorker({ streamServer: stream });
  const { startPushWorker } = await import("@contfu/svc-backend/push-worker/push-worker");
  await startPushWorker();

  // Start the sync worker (skip in test mode — E2E tests use webhook fixtures
  // and the worker's PGLite instance conflicts with the main app's in CI).
  if (process.env.NODE_ENV !== "test") {
    // Wire the onItems callback to broadcast items to all connected clients
    worker.onItems((items, connections) => {
      stream.broadcast(items, connections);
    });

    // Wire the onSchema callback to broadcast schema changes to consumers
    worker.onSchema((userId, collectionId, name, displayName, schema, renames) => {
      const event: WireEvent =
        Object.keys(renames).length > 0
          ? [EventType.COLLECTION_SCHEMA, name, displayName, schema, renames]
          : [EventType.COLLECTION_SCHEMA, name, displayName, schema];
      stream.broadcastToCollection(userId, collectionId, event);
    });

    await worker.start();
  }

  // Start the web sync scheduler (periodic polling for web sources).
  // Skip in test mode for the same reasons as the sync worker above.
  if (process.env.NODE_ENV !== "test") {
    const { startWebSyncScheduler } =
      await import("@contfu/svc-backend/infra/sync-scheduler/web-sync-scheduler");
    startWebSyncScheduler();
  }

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

  await stopWebhookFetchWorker();

  const { stopWebSyncScheduler } =
    await import("@contfu/svc-backend/infra/sync-scheduler/web-sync-scheduler");
  stopWebSyncScheduler();

  // Clear singletons
  if (streamServer) {
    streamServer.shutdown();
  }
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
