import type { Item } from "./items";

export const EventType = {
  // Protocol messages (0-9)
  PING: 0,
  SNAPSHOT_START: 1,
  SNAPSHOT_END: 2,
  STREAM_CONNECTED: 3,
  STREAM_DISCONNECTED: 4,
  // Collection events (10-29)
  SCHEMA: 10,
  // Item events (30-49)
  CHANGED: 30,
  DELETED: 31,
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

type EventBase<T extends EventType> = {
  type: T;
};

/**
 * Provides a created or changed item.
 */
export type ChangedEvent = EventBase<typeof EventType.CHANGED> & {
  item: Item;
};

/**
 * Provides a deleted item id.
 * This is only sent, if the source supports web hooks.
 */
export type DeletedEvent = EventBase<typeof EventType.DELETED> & {
  item: Buffer;
};

export type ItemEvent = ChangedEvent | DeletedEvent;

/**
 * Sync event emitted by /api/sync. Includes the event stream index.
 */
export type SyncChangedEvent = ChangedEvent & {
  index: number;
};

export type SyncDeletedEvent = DeletedEvent & {
  index: number;
};

export type SyncEvent = SyncChangedEvent | SyncDeletedEvent;
