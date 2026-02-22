import type { Item } from "./items";

export enum EventType {
  CHANGED = 1,
  DELETED = 2,
}

type EventBase<T extends EventType> = {
  type: T;
};

/**
 * Provides a created or changed item.
 */
export type ChangedEvent = EventBase<EventType.CHANGED> & {
  item: Item;
};

/**
 * Provides a deleted item id.
 * This is only sent, if the source supports web hooks.
 */
export type DeletedEvent = EventBase<EventType.DELETED> & {
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
