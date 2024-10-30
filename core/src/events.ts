import { Item } from "./items";

export enum EventType {
  CONNECTED = 0,
  ERROR = 1,
  CREATED = 2,
  CHANGED = 3,
  DELETED = 4,
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

export type CreatedEvent = EventBase<EventType.CREATED> & {
  item: Item;
};

export type ChangedEvent = EventBase<EventType.CHANGED> & {
  item: Item;
};

export type DeletedEvent = EventBase<EventType.DELETED> & {
  item: Buffer;
};

export type ItemEvent = CreatedEvent | ChangedEvent | DeletedEvent;
