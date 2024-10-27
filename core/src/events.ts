import { Item } from "./items";

export enum EventType {
  CONNECTED = 0,
  ERROR = 1,
  CHANGED = 2,
  DELETED = 3,
}

type EventBase<T extends EventType> = {
  type: T;
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

export type ItemEvent = ChangedEvent | DeletedEvent;
