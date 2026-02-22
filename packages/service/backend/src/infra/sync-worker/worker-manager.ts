import {
  SyncMessageType,
  type ItemsFetchedMessage,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "./messages";
import { createLogger } from "../logger/index";
import { and, eq } from "drizzle-orm";

const log = createLogger("sync-worker-manager");

import {
  collectionTable,
  connectionTable,
  consumerTable,
  db,
  influxTable,
  sourceCollectionTable,
  sourceTable,
} from "../db/db";
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
    log.info("Sync worker started");
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
    log.error({ err: error }, "Worker error");

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
        log.warn({ messageType: (msg as { type: number }).type }, "Unknown worker message type");
    }
  }

  private async handleItemsFetched(msg: ItemsFetchedMessage) {
    if (!this.itemsCallback || msg.items.length === 0) return;

    log.info(
      {
        itemCount: msg.items.length,
        userId: msg.userId,
        sourceCollectionId: msg.sourceCollectionId,
      },
      "Items received from worker",
    );

    // Look up which collections receive items from this source collection (via influx)
    const collectionIds = await getCollectionIdsForSourceCollection(
      msg.userId,
      msg.sourceCollectionId,
    );
    const collectionRefPolicies = await getCollectionRefPolicies(
      msg.userId,
      msg.sourceCollectionId,
      collectionIds,
    );

    // Get connections for those collections
    const connections = await getConnectionsForCollections(
      msg.userId,
      collectionIds,
      collectionRefPolicies,
    );
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
  collectionRefPolicies: Map<number, boolean>,
): Promise<ConnectionInfo[]> {
  if (collectionIds.length === 0) return [];
  const results: ConnectionInfo[] = [];
  for (const collectionId of collectionIds) {
    const connections = await db
      .select({
        userId: connectionTable.userId,
        consumerId: connectionTable.consumerId,
        collectionId: connectionTable.collectionId,
        includeRef: connectionTable.includeRef,
        consumerIncludeRef: consumerTable.includeRef,
        collectionIncludeRef: collectionTable.includeRef,
        lastItemChanged: connectionTable.lastItemChanged,
      })
      .from(connectionTable)
      .innerJoin(
        collectionTable,
        and(
          eq(connectionTable.userId, collectionTable.userId),
          eq(connectionTable.collectionId, collectionTable.id),
        ),
      )
      .innerJoin(
        consumerTable,
        and(
          eq(connectionTable.userId, consumerTable.userId),
          eq(connectionTable.consumerId, consumerTable.id),
        ),
      )
      .where(
        and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)),
      );
    for (const c of connections) {
      results.push({
        userId: c.userId,
        consumerId: c.consumerId,
        collectionId: c.collectionId,
        includeRef:
          Boolean(c.includeRef) &&
          Boolean(c.consumerIncludeRef) &&
          Boolean(c.collectionIncludeRef) &&
          (collectionRefPolicies.get(c.collectionId) ?? true),
        lastItemChanged: c.lastItemChanged,
      });
    }
  }
  return results;
}

async function getCollectionRefPolicies(
  userId: number,
  sourceCollectionId: number,
  collectionIds: number[],
): Promise<Map<number, boolean>> {
  if (collectionIds.length === 0) return new Map();

  const rows = await db
    .select({
      collectionId: influxTable.collectionId,
      influxIncludeRef: influxTable.includeRef,
      sourceIncludeRef: sourceTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(influxTable)
    .innerJoin(
      collectionTable,
      and(
        eq(influxTable.userId, collectionTable.userId),
        eq(influxTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(influxTable.userId, sourceCollectionTable.userId),
        eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
      ),
    )
    .innerJoin(
      sourceTable,
      and(
        eq(sourceCollectionTable.userId, sourceTable.userId),
        eq(sourceCollectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(
      and(eq(influxTable.userId, userId), eq(influxTable.sourceCollectionId, sourceCollectionId)),
    );

  const policies = new Map<number, boolean>();
  for (const collectionId of collectionIds) policies.set(collectionId, true);

  for (const row of rows) {
    const prev = policies.get(row.collectionId) ?? true;
    const allow =
      Boolean(row.sourceIncludeRef) &&
      Boolean(row.influxIncludeRef) &&
      Boolean(row.collectionIncludeRef);
    policies.set(row.collectionId, prev && allow);
  }

  return policies;
}
