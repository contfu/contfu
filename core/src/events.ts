import { Item } from "./items";

export enum EventType {
  ERROR = 0,
  CHANGED = 1,
  DELETED = 2,
  LIST_IDS = 3, // TODO: should be removed. Only used for detecting deletions.
}

type EventBase<T extends EventType> = {
  type: T;
  src: number;
  collection: number;
};

export type ErrorEvent = {
  type: EventType.ERROR;
  code: string;
};

export type ChangedEvent<T extends Item = Item> =
  EventBase<EventType.CHANGED> & {
    item: T;
  };

export type DeletedEvent = EventBase<EventType.DELETED> & {
  item: string;
};

export type ListIdsEvent = EventBase<EventType.LIST_IDS> & {
  ids: string[];
};

export type ItemEvent<T extends Item = Item> =
  | ChangedEvent<T>
  | DeletedEvent
  | ListIdsEvent;
