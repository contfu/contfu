import { Item } from "@contfu/core";

export enum EventType {
  CONNECTED = 0,
  ERROR = 1,
  CHANGED = 2,
  DELETED = 3,
  // Internal event type values are larger than the 1 byte public event type.
  LIST_IDS = 256,
}

type EventBase<T extends EventType> = {
  type: T;
  account: number;
  collection: number;
};

export type ConnectedEvent = { type: EventType.CONNECTED };

export type ErrorEvent = {
  type: EventType.ERROR;
  code: string;
};

export type ChangedEvent = EventBase<EventType.CHANGED> & {
  item: Item;
};

export type DeletedEvent = EventBase<EventType.DELETED> & {
  item: Buffer;
};

export type ListIdsEvent = EventBase<EventType.LIST_IDS> & {
  ids: Buffer[];
};

export type ItemEvent = ChangedEvent | DeletedEvent | ListIdsEvent;
