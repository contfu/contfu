/// <reference lib="webworker" />
declare const self: Worker;

import {
  AppToWorkerMessage,
  ExtendedFetchOpts,
  MessageBus,
  SourceType,
  SyncMessageType,
  UserSyncItem,
  WorkerToAppMessage,
} from "@contfu/core";
import {
  combineLatest,
  defer,
  endWith,
  lastValueFrom,
  merge,
  repeat,
  Subject,
  tap,
  timer,
} from "rxjs";
import { NotionFetchOpts, NotionSource } from "./sources/notion";
import { StrapiFetchOpts, StrapiSource } from "./sources/strapi";
import { WebFetchOpts, WebSource } from "./sources/web";
import { combine2ints, combine3ints } from "./util/numbers/numbers";
import { SortedSet } from "./util/structures/sorted-set";

// Constants
const MAX_COLLECTION_PULL_SIZE = Number(process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000);
const MIN_FETCH_INTERVAL = Number(process.env.MIN_FETCH_INTERVAL ?? 10_000);

// Sources
const notionSource = new NotionSource();
const strapiSource = new StrapiSource();
const webSource = new WebSource();

// Message bus for request/response
const syncInfoBus = new MessageBus<ExtendedFetchOpts[]>();
const addItemIdsBus = new MessageBus<boolean>();

// ID compression utilities
const [compressConsumerIdWithCount, expandConsumerIdWithCount] = combine3ints(32, 10, 10);
const [compressCollectionId, expandCollectionId] = combine2ints(32, 20);

// Active consumers stored in compressed binary format
const activeConsumers = new SortedSet<number>();

// Items subject for broadcasting
const itemsSubject = new Subject<UserSyncItem>();

// Handle messages from the app
self.onmessage = async (e: MessageEvent<AppToWorkerMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case SyncMessageType.ACTIVATE_CONSUMER:
      activateConsumer(msg.userId, msg.consumerId, msg.collectionCount);
      break;

    case SyncMessageType.DEACTIVATE_CONSUMER:
      deactivateConsumer(msg.userId, msg.consumerId);
      break;

    case SyncMessageType.SYNC_INFO_RESPONSE:
      syncInfoBus.respond(msg.requestId, msg.opts);
      break;

    case SyncMessageType.ADD_ITEM_IDS_RESPONSE:
      addItemIdsBus.respond(msg.requestId, msg.success);
      break;

    case SyncMessageType.SHUTDOWN:
      process.exit(0);
  }
};

function activateConsumer(userId: number, consumerId: number, collectionCount: number) {
  activeConsumers.add(compressConsumerIdWithCount(userId, consumerId, collectionCount));
}

function deactivateConsumer(userId: number, consumerId: number) {
  // Find and remove consumer with any collection count
  for (let i = 0; i < activeConsumers.length; i++) {
    const [uid, cid] = expandConsumerIdWithCount(activeConsumers[i]);
    if (uid === userId && cid === consumerId) {
      activeConsumers.splice(i, 1);
      break;
    }
  }
}

// Request sync info from the app
async function requestSyncInfo(pairs: [number, number][]): Promise<ExtendedFetchOpts[]> {
  const requestId = syncInfoBus.generateId();
  const promise = syncInfoBus.request<ExtendedFetchOpts[]>(requestId);
  self.postMessage({
    type: SyncMessageType.REQUEST_SYNC_INFO,
    requestId,
    pairs,
  } as WorkerToAppMessage);
  return promise;
}

// Request to add item IDs to the database
async function requestAddItemIds(
  userId: number,
  collectionId: number,
  itemIds: Buffer[],
): Promise<boolean> {
  const requestId = addItemIdsBus.generateId();
  const promise = addItemIdsBus.request<boolean>(requestId);
  self.postMessage({
    type: SyncMessageType.REQUEST_ADD_ITEM_IDS,
    requestId,
    userId,
    collectionId,
    itemIds,
  } as WorkerToAppMessage);
  return promise;
}

// Sync loop
const sync$ = defer(() =>
  combineLatest([timer(MIN_FETCH_INTERVAL), syncAllActiveConsumers()]),
).pipe(repeat());

async function syncAllActiveConsumers() {
  if (activeConsumers.length === 0) return;
  const consumers = [...activeConsumers];
  let partition: [number, number][] = [];
  for (const consumer of consumers) {
    const [userId, consumerId, count] = expandConsumerIdWithCount(consumer);
    if (partition.length + count > MAX_COLLECTION_PULL_SIZE) {
      await syncConsumers(partition);
      partition = [];
      continue;
    }
    partition.push([userId, consumerId]);
  }
  if (partition.length > 0) await syncConsumers(partition);
}

async function syncConsumers(consumers: [number, number][]) {
  const opts = await requestSyncInfo(consumers);
  const idsToAdd = new Map<number, Buffer[]>();
  const fetchedItems: UserSyncItem[] = [];

  await lastValueFrom(
    merge(
      ...opts.map((o) => {
        // Dispatch to appropriate source based on type
        const source$ =
          o.type === SourceType.STRAPI
            ? strapiSource.fetch(o as StrapiFetchOpts)
            : o.type === SourceType.WEB
              ? webSource.fetch(o as WebFetchOpts)
              : notionSource.fetch({
                  ...o,
                  credentials: o.credentials?.toString("utf-8") ?? "",
                } as NotionFetchOpts);

        return combineLatest([[o.user], source$]).pipe(
          tap(([user, item]) => {
            const collection = compressCollectionId(user, o.collection);
            const ids = idsToAdd.get(collection);
            if (ids == null) idsToAdd.set(collection, [item.id]);
            else ids.push(item.id);
            const userItem: UserSyncItem = { ...item, user };
            fetchedItems.push(userItem);
            itemsSubject.next(userItem);
          }),
        );
      }),
    ).pipe(endWith(null)),
  );

  // Send items to app in batches
  if (fetchedItems.length > 0) {
    self.postMessage({
      type: SyncMessageType.ITEMS_FETCHED,
      items: fetchedItems,
    } as WorkerToAppMessage);
  }

  // Request to store item IDs
  for (const [collection, itemIds] of idsToAdd.entries()) {
    const [userId, collectionId] = expandCollectionId(collection);
    await requestAddItemIds(userId, collectionId, itemIds);
  }
}

// Subscribe to sync loop
sync$.subscribe({
  error: (err) => console.error("Sync error:", err),
});

// Signal ready
self.postMessage({ type: SyncMessageType.WORKER_READY } as WorkerToAppMessage);
