import { Item } from "./items";

export enum EventType {
  CHANGED = 1,
  DELETED = 2,
  LIST_IDS = 3,
}

type EventBase<T extends EventType> = {
  type: T;
  src: number;
  collection: number;
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
