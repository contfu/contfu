import { ItemEvent } from "@contfu/core";

type InternalEventBase<T extends InternalEventType> = {
  type: T;
  src: number;
  collection: number;
};

export enum InternalEventType {
  // Internal event type values are larger than the 1 byte public event type.
  LIST_IDS = 256,
}

export type ListIdsEvent = InternalEventBase<InternalEventType.LIST_IDS> & {
  ids: number[];
};

export type InternalItemEvent = ListIdsEvent;
export type ItemEventExtended = InternalItemEvent | ItemEvent;
