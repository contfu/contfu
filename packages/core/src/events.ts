import type { Item } from "./items";

export enum EventType {
  CONNECTED = 0,
  ERROR = 1,
  CHANGED = 2,
  DELETED = 3,
  LIST_IDS = 4,
  CHECKSUM = 5,
}

type EventBase<T extends EventType> = {
  type: T;
};

/**
 * Indicates a successful connection.
 */
export type ConnectedEvent = EventBase<EventType.CONNECTED>;

/**
 * Provides an error code.
 */
export type ErrorEvent = EventBase<EventType.ERROR> & {
  code: string;
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

/**
 * Provides a list of ids inside a collection.
 * This is used to identify missing or deleted items.
 */
export type ListIdsEvent = EventBase<EventType.LIST_IDS> & {
  ids: Buffer[];
  collection: number;
};

/**
 * Provides a checksum of the ids inside a collection.
 * If the checksum does not match, there may be missing or deleted items.
 */
export type ChecksumEvent = EventBase<EventType.CHECKSUM> & {
  checksum: Buffer;
  collection: number;
};

export type ItemEvent = ChangedEvent | DeletedEvent | ListIdsEvent | ChecksumEvent;
