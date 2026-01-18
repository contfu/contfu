import type { Item } from "./items";

/**
 * Message types for communication between the app service and the sync worker.
 * App → Worker messages use values 1-99.
 * Worker → App messages use values 100+.
 */
export enum SyncMessageType {
  // App → Worker
  ACTIVATE_CONSUMER = 1,
  DEACTIVATE_CONSUMER = 2,
  SYNC_INFO_RESPONSE = 3,
  ADD_ITEM_IDS_RESPONSE = 4,
  SHUTDOWN = 5,

  // Worker → App
  WORKER_READY = 100,
  ITEMS_FETCHED = 101,
  REQUEST_SYNC_INFO = 102,
  REQUEST_ADD_ITEM_IDS = 103,
}

/** Extended fetch options with user context. */
export type ExtendedFetchOpts = {
  user: number;
  collection: number;
  ref?: Buffer;
  url?: string;
  credentials?: Buffer;
  since?: number;
};

/** User-tagged item for multi-tenant routing. */
export type UserSyncItem = Item & {
  user: number;
};

// App → Worker messages

export type ActivateConsumerMessage = {
  type: SyncMessageType.ACTIVATE_CONSUMER;
  userId: number;
  consumerId: number;
  collectionCount: number;
};

export type DeactivateConsumerMessage = {
  type: SyncMessageType.DEACTIVATE_CONSUMER;
  userId: number;
  consumerId: number;
};

export type SyncInfoResponseMessage = {
  type: SyncMessageType.SYNC_INFO_RESPONSE;
  requestId: number;
  opts: ExtendedFetchOpts[];
};

export type AddItemIdsResponseMessage = {
  type: SyncMessageType.ADD_ITEM_IDS_RESPONSE;
  requestId: number;
  success: boolean;
};

export type ShutdownMessage = {
  type: SyncMessageType.SHUTDOWN;
};

// Worker → App messages

export type WorkerReadyMessage = {
  type: SyncMessageType.WORKER_READY;
};

export type ItemsFetchedMessage = {
  type: SyncMessageType.ITEMS_FETCHED;
  items: UserSyncItem[];
};

export type RequestSyncInfoMessage = {
  type: SyncMessageType.REQUEST_SYNC_INFO;
  requestId: number;
  /** Array of [userId, consumerId] pairs to get sync info for. */
  pairs: [number, number][];
};

export type RequestAddItemIdsMessage = {
  type: SyncMessageType.REQUEST_ADD_ITEM_IDS;
  requestId: number;
  userId: number;
  collectionId: number;
  itemIds: Buffer[];
};

/** Union of all messages that the app can send to the worker. */
export type AppToWorkerMessage =
  | ActivateConsumerMessage
  | DeactivateConsumerMessage
  | SyncInfoResponseMessage
  | AddItemIdsResponseMessage
  | ShutdownMessage;

/** Union of all messages that the worker can send to the app. */
export type WorkerToAppMessage =
  | WorkerReadyMessage
  | ItemsFetchedMessage
  | RequestSyncInfoMessage
  | RequestAddItemIdsMessage;

/** All sync messages. */
export type SyncMessage = AppToWorkerMessage | WorkerToAppMessage;
