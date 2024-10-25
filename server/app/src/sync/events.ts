import { SyncItem } from "../data/data";

export enum EventType {
  ERROR = 0,
  CHANGED = 1,
  DELETED = 2,
  // Internal event type values are larger than the 1 byte public event type.
  LIST_IDS = 256,
}

type EventBase<T extends EventType> = {
  type: T;
  account: number;
  collection: number;
};

export type ErrorEvent = {
  type: EventType.ERROR;
  code: string;
};

export type ChangedEvent = EventBase<EventType.CHANGED> & {
  item: SyncItem;
};

export type DeletedEvent = EventBase<EventType.DELETED> & {
  item: number;
};

export type ListIdsEvent = EventBase<EventType.LIST_IDS> & {
  ids: number[];
};

export type ItemEvent = ChangedEvent | DeletedEvent | ListIdsEvent;
