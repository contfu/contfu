import type { Item } from "./items";

export const EventType = {
  // Protocol messages (0-9)
  PING: 0,
  SNAPSHOT_START: 1,
  SNAPSHOT_END: 2,
  STREAM_CONNECTED: 3,
  STREAM_DISCONNECTED: 4,
  // Collection events (10-29)
  COLLECTION_SCHEMA: 10,
  COLLECTION_RENAMED: 11,
  COLLECTION_REMOVED: 12,
  // Item events (30-49)
  ITEM_CHANGED: 30,
  ITEM_DELETED: 31,
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

type EventBase<T extends EventType> = {
  type: T;
};

/**
 * Provides a created or changed item.
 */
export type ItemChangedEvent = EventBase<typeof EventType.ITEM_CHANGED> & {
  item: Item;
};

/**
 * Provides a deleted item id.
 * This is only sent, if the source supports web hooks.
 */
export type ItemDeletedEvent = EventBase<typeof EventType.ITEM_DELETED> & {
  item: Buffer;
};

export type ItemEvent = ItemChangedEvent | ItemDeletedEvent;

/**
 * Sync event emitted by /api/sync. Includes the event stream index.
 */
export type SyncItemChangedEvent = ItemChangedEvent & {
  index: number;
};

export type SyncItemDeletedEvent = ItemDeletedEvent & {
  index: number;
};

export type SyncEvent = SyncItemChangedEvent | SyncItemDeletedEvent;
