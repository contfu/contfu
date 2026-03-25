import { EventType, type WireItem } from "@contfu/core";
import {
  getSnapshotProgress,
  publishSnapshot,
  purgeConnectionSnapshot,
  replaySnapshotFrom,
} from "../../infra/nats/snapshot-stream";
import { publishEvent, type StoredWireItemEvent } from "../../infra/nats/event-stream";

/**
 * Applies schema renames and/or removals to an existing consumer snapshot in-place.
 *
 * Replays the snapshot from NATS, transforms item properties for the given
 * collection, repopulates the snapshot stream, and pushes updated items
 * to the event stream so live WebSocket consumers receive them.
 */
export async function applySchemaTransform(
  userId: number,
  consumerId: number,
  collectionName: string,
  collectionId: number,
  renames: Record<string, string>, // oldName → newName
  removals: string[],
): Promise<void> {
  if (Object.keys(renames).length === 0 && removals.length === 0) return;

  const existing = await getSnapshotProgress(userId, consumerId);
  if (existing?.inProgress) return;

  const updatedItems: StoredWireItemEvent[] = [];
  const transformed: StoredWireItemEvent[] = [];

  for await (const { event } of replaySnapshotFrom(userId, consumerId, 1)) {
    if (event[0] === EventType.ITEM_CHANGED) {
      const wireItem = [...event[1]] as WireItem;
      if (wireItem[3] === collectionName) {
        const props = { ...wireItem[5] };
        for (const [oldKey, newKey] of Object.entries(renames)) {
          if (oldKey in props) {
            props[newKey] = props[oldKey];
            delete props[oldKey];
          }
        }
        for (const key of removals) delete props[key];
        wireItem[5] = props;
        updatedItems.push([EventType.ITEM_CHANGED, wireItem]);
      }
      transformed.push([EventType.ITEM_CHANGED, wireItem]);
    } else {
      transformed.push(event);
    }
  }

  await purgeConnectionSnapshot(userId, consumerId);
  for (const event of transformed) await publishSnapshot(userId, consumerId, event);

  // Push transformed items to event stream so live WebSocket consumers receive updates
  for (const event of updatedItems) await publishEvent(userId, collectionId, event);
}
