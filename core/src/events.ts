import { Item } from "./items";

export enum EventType {
  CHANGED,
  DELETED,
  LIST_IDS,
}

export type ChangedEvent<T extends Item = Item> = {
  type: EventType.CHANGED;
  id: string;
  item: T;
};

export type DeletedEvent = {
  type: EventType.DELETED;
  id: string;
  collection: string;
  itemId: string;
};

export type ListIdsEvent = {
  type: EventType.LIST_IDS;
  id: string;
  collection: string;
  itemIds: string[];
};

export type ItemEvent<T extends Item = Item> =
  | ChangedEvent<T>
  | DeletedEvent
  | ListIdsEvent;
