import { Item } from "@contfu/core";

export enum EventType {
  CONNECTED = 0,
  ERROR = 1,
  CREATED = 2,
  CHANGED = 3,
  DELETED = 4,
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

export type CreatedEvent = EventBase<EventType.CREATED> & {
  item: Item;
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

export type ItemEvent =
  | CreatedEvent
  | ChangedEvent
  | DeletedEvent
  | ListIdsEvent;

export function createdEvent(
  { account, collection }: { account: number; collection: number },
  item: Item
): CreatedEvent {
  return {
    type: EventType.CREATED,
    item,
    account,
    collection,
  };
}

export function changedEvent(
  { account, collection }: { account: number; collection: number },
  item: Item
): ChangedEvent {
  return {
    type: EventType.CHANGED,
    item,
    account,
    collection,
  };
}

export function deletedEvent(
  { account, collection }: { account: number; collection: number },
  item: Buffer
): DeletedEvent {
  return {
    type: EventType.DELETED,
    item,
    account,
    collection,
  };
}
