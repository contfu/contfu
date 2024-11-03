import { ChangedEvent, DeletedEvent, EventType, Item } from "@contfu/core";

export function changedEvent(item: Item): ChangedEvent {
  return {
    type: EventType.CHANGED,
    item,
  };
}

export function deletedEvent(uid: Buffer): DeletedEvent {
  return {
    type: EventType.DELETED,
    item: uid,
  };
}
