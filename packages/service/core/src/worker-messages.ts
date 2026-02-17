import type { Item } from "@contfu/core";
import type { SyncMessageType } from "./constants";

/** User-tagged item for multi-tenant routing. */
export type UserSyncItem = Item & {
  user: number;
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
  sourceCollectionId: number;
};

/** Union of all messages that the app can send to the worker. */
export type AppToWorkerMessage = ShutdownMessage;

/** Union of all messages that the worker can send to the app. */
export type WorkerToAppMessage = WorkerReadyMessage | ItemsFetchedMessage;

/** All sync messages. */
export type SyncMessage = AppToWorkerMessage | WorkerToAppMessage;
