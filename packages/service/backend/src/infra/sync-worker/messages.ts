import type { Item, ConnectionType } from "@contfu/core";

/**
 * Message types for communication between the app service and the sync worker.
 * App -> Worker messages use values 1-99.
 * Worker -> App messages use values 100+.
 */
export enum SyncMessageType {
  // App -> Worker
  SHUTDOWN = 5,

  // Worker -> App
  WORKER_READY = 100,
  ITEMS_FETCHED = 101,
}

/** User-tagged item for multi-tenant routing. */
export type UserSyncItem = Omit<Item, "ref"> & {
  ref: string;
  sourceType: ConnectionType;
  user: number;
  /** Whether ref should be transmitted for this item in this route context. */
  includeRef?: boolean;
};

// App -> Worker messages

export type ShutdownMessage = {
  type: SyncMessageType.SHUTDOWN;
};

// Worker -> App messages

export type WorkerReadyMessage = {
  type: SyncMessageType.WORKER_READY;
};

export type ItemsFetchedMessage = {
  type: SyncMessageType.ITEMS_FETCHED;
  items: UserSyncItem[];
  userId: number;
  collectionId: number;
};

/** Union of all messages that the app can send to the worker. */
export type AppToWorkerMessage = ShutdownMessage;

/** Union of all messages that the worker can send to the app. */
export type WorkerToAppMessage = WorkerReadyMessage | ItemsFetchedMessage;

/** All sync messages. */
export type SyncMessage = AppToWorkerMessage | WorkerToAppMessage;
