import {
  MessageBus,
  SyncMessageType,
  type AppToWorkerMessage,
  type ExtendedFetchOpts,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "@contfu/core";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { collectionTable, connectionTable, db, sourceTable } from "../db/db";
import { ITEM_ID_SIZE } from "../util/ids/ids";
import { SortedSet } from "../util/structures/sorted-set";
import type { ConnectionInfo } from "../websocket/ws-server";

const NO_ITEM_IDS = Buffer.alloc(0);

type ItemsCallback = (items: UserSyncItem[], connections: ConnectionInfo[]) => void;

export class SyncWorkerManager {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private isReady = false;
  private itemsCallback: ItemsCallback | null = null;
  private syncInfoBus = new MessageBus<ExtendedFetchOpts[]>();
  private addItemIdsBus = new MessageBus<boolean>();

  async start() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    this.worker = new Worker(new URL("../../../../../sync/src/worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.onerror = (e) => this.handleWorkerError(e);

    await this.readyPromise;
    console.log("Sync worker started");
  }

  async stop() {
    if (!this.worker) return;

    // Send shutdown message to allow graceful cleanup
    this.worker.postMessage({ type: SyncMessageType.SHUTDOWN } as AppToWorkerMessage);

    // Clear all pending requests
    this.syncInfoBus.clear(new Error("Worker shutting down"));
    this.addItemIdsBus.clear(new Error("Worker shutting down"));

    // Forcefully terminate the worker after a short delay
    const worker = this.worker;
    this.worker = null;
    this.isReady = false;

    // Give worker time to cleanup, then terminate
    setTimeout(() => worker.terminate(), 100);
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error("Worker error:", error);

    // Clear all pending requests so they don't hang
    this.syncInfoBus.clear(new Error("Worker crashed"));
    this.addItemIdsBus.clear(new Error("Worker crashed"));

    // If worker crashes before ready, reject the ready promise
    if (!this.isReady && this.readyResolve) {
      this.readyResolve = null;
    }
  }

  onItems(callback: ItemsCallback) {
    this.itemsCallback = callback;
  }

  async activateConsumer(userId: string, consumerId: number): Promise<number> {
    const collectionCount = await countCollectionsForConsumer(userId, consumerId);
    // TODO: Update @contfu/core to use string userId
    this.worker?.postMessage({
      type: SyncMessageType.ACTIVATE_CONSUMER,
      userId: userId as unknown as number,
      consumerId,
      collectionCount,
    } as AppToWorkerMessage);
    return collectionCount;
  }

  deactivateConsumer(userId: string, consumerId: number) {
    // TODO: Update @contfu/core to use string userId
    this.worker?.postMessage({
      type: SyncMessageType.DEACTIVATE_CONSUMER,
      userId: userId as unknown as number,
      consumerId,
    } as AppToWorkerMessage);
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
        await this.handleItemsFetched(msg.items);
        break;

      case SyncMessageType.REQUEST_SYNC_INFO:
        // TODO: Update @contfu/core to use string userId
        await this.handleSyncInfoRequest(
          msg.requestId,
          msg.pairs.map(([u, c]) => [String(u), c] as [string, number]),
        );
        break;

      case SyncMessageType.REQUEST_ADD_ITEM_IDS:
        // TODO: Update @contfu/core to use string userId
        await this.handleAddItemIds(
          msg.requestId,
          String(msg.userId),
          msg.collectionId,
          msg.itemIds,
        );
        break;

      default:
        console.warn("Unknown worker message type:", (msg as { type: number }).type);
    }
  }

  private async handleItemsFetched(items: UserSyncItem[]) {
    if (!this.itemsCallback || items.length === 0) return;

    // Get collection IDs from items
    // TODO: Update @contfu/core to use string userId - item.user is number in core
    const collectionRefs = [...new Set(items.map((i) => `${i.user}:${i.collection}`))].map(
      (ref) => {
        const [userId, collectionId] = ref.split(":");
        return [userId, Number(collectionId)] as const;
      },
    );

    // Get connections to route items
    const connections = await getConnectionsToCollections(collectionRefs);
    this.itemsCallback(items, connections);
  }

  private async handleSyncInfoRequest(requestId: number, pairs: [string, number][]) {
    const opts = await getNextCollectionFetchOpts(pairs);
    this.worker?.postMessage({
      type: SyncMessageType.SYNC_INFO_RESPONSE,
      requestId,
      opts,
    } as AppToWorkerMessage);
  }

  private async handleAddItemIds(
    requestId: number,
    userId: string,
    collectionId: number,
    itemIds: Buffer[],
  ) {
    try {
      await addItemIds(userId, collectionId, itemIds);
      this.worker?.postMessage({
        type: SyncMessageType.ADD_ITEM_IDS_RESPONSE,
        requestId,
        success: true,
      } as AppToWorkerMessage);
    } catch (error) {
      console.error("Failed to add item IDs:", error);
      this.worker?.postMessage({
        type: SyncMessageType.ADD_ITEM_IDS_RESPONSE,
        requestId,
        success: false,
      } as AppToWorkerMessage);
    }
  }
}

// Database access functions moved from sync service

async function countCollectionsForConsumer(userId: string, consumerId: number) {
  return db.$count(
    db
      .select({ collectionId: connectionTable.collectionId })
      .from(connectionTable)
      .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)))
      .groupBy(connectionTable.collectionId),
  );
}

async function getConnectionsToCollections(
  refs: (readonly [userId: string, collectionId: number])[],
): Promise<ConnectionInfo[]> {
  // Build a simple query since inArray with tuples is complex
  const results: ConnectionInfo[] = [];
  for (const [userId, collectionId] of refs) {
    const connections = await db
      .select()
      .from(connectionTable)
      .where(
        and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)),
      )
      .orderBy(asc(connectionTable.userId), asc(connectionTable.collectionId));
    results.push(...connections);
  }
  return results;
}

async function getNextCollectionFetchOpts(pairs: [userId: string, collectionId: number][]) {
  const state = await getConnectionsWithCollectionSyncInfo(pairs);

  const collectionFetchopts = new Array<ExtendedFetchOpts>();
  let current: ExtendedFetchOpts | null = null;
  for (const { consumer: _, lastItemChanged, ...s } of state) {
    // state is sorted by userId, collectionId, so we can safely assume that we
    // create only one fetchOpts per userId
    if (current == null || current.user !== (s.user as unknown as number))
      collectionFetchopts.push((current = s as unknown as ExtendedFetchOpts));
    if (lastItemChanged != null) {
      current.since =
        current.since == null
          ? lastItemChanged
          : current.since < lastItemChanged
            ? current.since
            : lastItemChanged;
    }
  }
  return collectionFetchopts;
}

async function getConnectionsWithCollectionSyncInfo(ids: [userId: string, collectionId: number][]) {
  // Build a simple query since inArray with tuples is complex
  const results: Array<{
    user: string;
    consumer: number;
    collection: number;
    source: number;
    type: number;
    lastItemChanged: number | null;
    url: string | null;
    ref: Buffer | null;
    credentials: Buffer | null;
  }> = [];

  for (const [userId, collectionId] of ids) {
    const rows = await db
      .select({
        user: connectionTable.userId,
        consumer: connectionTable.consumerId,
        collection: connectionTable.collectionId,
        source: collectionTable.sourceId,
        type: sourceTable.type,
        lastItemChanged: connectionTable.lastItemChanged,
        url: sourceTable.url,
        ref: collectionTable.ref,
        credentials: sourceTable.credentials,
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
        sourceTable,
        and(
          eq(collectionTable.userId, sourceTable.userId),
          eq(collectionTable.sourceId, sourceTable.id),
        ),
      )
      .where(
        and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)),
      )
      .orderBy(asc(connectionTable.userId), asc(connectionTable.collectionId));
    results.push(...rows);
  }

  return results;
}

async function addItemIds(userId: string, collectionId: number, toAdd: Buffer[]) {
  const ids = await getItemIds(userId, collectionId);

  for (const id of toAdd) ids.add(id);
  await db
    .update(collectionTable)
    .set({ itemIds: serializeIds(ids) })
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)));
}

async function getItemIds(userId: string, collectionId: number) {
  const result = await db
    .select({ itemIds: collectionTable.itemIds })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)));
  return new SortedSet<Buffer>({
    seed: deserializeIds(result[0]?.itemIds ?? NO_ITEM_IDS),
    isSorted: true,
    // @ts-expect-error Buffer.compare types differ between Node/Bun
    compare: (a: Buffer, b: Buffer) => a.compare(b),
  });
}

function serializeIds(ids: Buffer[]) {
  return Buffer.concat(ids as unknown as Uint8Array[]);
}

function deserializeIds(ids: Buffer) {
  const count = ids.length / ITEM_ID_SIZE;
  // oxlint-disable-next-line unicorn/no-new-array
  const result = new Array<Buffer>(count);
  for (let i = 0; i < count; i++) {
    const idx = i * ITEM_ID_SIZE;
    result[i] = ids.subarray(idx, idx + ITEM_ID_SIZE);
  }
  return result;
}
