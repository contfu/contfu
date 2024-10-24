import { Item } from "./items";

export enum EventType {
  ERROR = 0,
  CHANGED = 1,
  DELETED = 2,
}

type EventBase<T extends EventType> = {
  type: T;
  collection: number;
};

export type ErrorEvent = {
  type: EventType.ERROR;
  code: string;
};

export type ChangedEvent = EventBase<EventType.CHANGED> & {
  item: Item;
};

export type DeletedEvent = EventBase<EventType.DELETED> & {
  item: number;
};

export type ItemEvent = ChangedEvent | DeletedEvent;
