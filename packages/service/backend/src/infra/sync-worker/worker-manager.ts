import {
  SyncMessageType,
  type ItemsFetchedMessage,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "@contfu/svc-core";
import { and, eq } from "drizzle-orm";
import { connectionTable, db, influxTable } from "../db/db";
import type { ConnectionInfo } from "../types";

type ItemsCallback = (items: UserSyncItem[], connections: ConnectionInfo[]) => void;

export class SyncWorkerManager {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private isReady = false;
  private itemsCallback: ItemsCallback | null = null;

  async start() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    const workerUrl =
      process.env.SYNC_WORKER_PATH ??
      new URL("../../../../sync/src/worker.ts", import.meta.url).href;
    this.worker = new Worker(workerUrl, { type: "module" });

    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.onerror = (e) => this.handleWorkerError(e);

    await this.readyPromise;
    console.log("Sync worker started");
  }

  async stop() {
    if (!this.worker) return;
    this.worker.postMessage({ type: SyncMessageType.SHUTDOWN });
    const worker = this.worker;
    this.worker = null;
    this.isReady = false;
    setTimeout(() => worker.terminate(), 100);
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error("Worker error:", error);

    // If worker crashes before ready, reject the ready promise
    if (!this.isReady && this.readyResolve) {
      this.readyResolve = null;
    }
  }

  onItems(callback: ItemsCallback) {
    this.itemsCallback = callback;
  }

  private async handleMessage(msg: WorkerToAppMessage) {
    switch (msg.type) {
      case SyncMessageType.WORKER_READY:
        // Guard against multiple WORKER_READY messages
        if (!this.isReady && this.readyResolve) {
          this.isReady = true;
          this.readyResolve();
          this.readyResolve = null;
        }
        break;

      case SyncMessageType.ITEMS_FETCHED:
        await this.handleItemsFetched(msg);
        break;

      default:
        console.warn("Unknown worker message type:", (msg as { type: number }).type);
    }
  }

  private async handleItemsFetched(msg: ItemsFetchedMessage) {
    if (!this.itemsCallback || msg.items.length === 0) return;

    // Look up which collections receive items from this source collection (via influx)
    const collectionIds = await getCollectionIdsForSourceCollection(
      msg.userId,
      msg.sourceCollectionId,
    );

    // Get connections for those collections
    const connections = await getConnectionsForCollections(msg.userId, collectionIds);
    this.itemsCallback(msg.items, connections);
  }
}

async function getCollectionIdsForSourceCollection(
  userId: number,
  sourceCollectionId: number,
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ collectionId: influxTable.collectionId })
    .from(influxTable)
    .where(
      and(eq(influxTable.userId, userId), eq(influxTable.sourceCollectionId, sourceCollectionId)),
    );
  return rows.map((r) => r.collectionId);
}

async function getConnectionsForCollections(
  userId: number,
  collectionIds: number[],
): Promise<ConnectionInfo[]> {
  if (collectionIds.length === 0) return [];
  const results: ConnectionInfo[] = [];
  for (const collectionId of collectionIds) {
    const connections = await db
      .select()
      .from(connectionTable)
      .where(
        and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)),
      );
    results.push(...connections);
  }
  return results;
}
