import { connectToStream, type ItemEvent } from "@contfu/client";
import { EventType } from "@contfu/core";
import { createOrUpdateItem } from "../items/createOrUpdateItem";
import { deleteItem } from "../items/deleteItem";

/**
 * Connect to the stream and persist events into the local database.
 * The consumer key is read from CONTFU_API_KEY (base64url) by default.
 */
export async function* connect(opts?: {
  key?: Buffer;
  from?: number;
  reconnect?: boolean;
}): AsyncGenerator<ItemEvent> {
  for await (const event of connectToStream(opts)) {
    if (event.type === EventType.CHANGED) {
      await createOrUpdateItem({
        id: event.item.id.toString("base64url"),
        ref: event.item.ref?.toString("base64url") ?? "",
        collection: event.item.collection,
        changedAt: event.item.changedAt,
        props: event.item.props,
        content: event.item.content,
      });
    } else if (event.type === EventType.DELETED) {
      await deleteItem(event.item.toString("base64url"));
    }
    yield event;
  }
}
