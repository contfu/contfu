import { connectToStream, type ItemEvent, type StreamEvent } from "@contfu/client";
import { EventType } from "@contfu/core";
import { createOrUpdateItem } from "../items/createOrUpdateItem";
import { deleteItem } from "../items/deleteItem";
import { getSyncIndex } from "../sync/getSyncIndex";
import { setSyncIndex } from "../sync/setSyncIndex";

/**
 * Connect to the stream and persist events into the local database.
 * The consumer key is read from CONTFU_API_KEY (base64url) by default.
 */
export async function* connect(opts?: {
  key?: Buffer;
  from?: number;
  reconnect?: boolean;
  url?: string;
  connectionEvents?: boolean;
}): AsyncGenerator<ItemEvent | StreamEvent> {
  const persistedFrom = await getSyncIndex();
  const from = opts?.from ?? (persistedFrom != null ? persistedFrom + 1 : undefined);
  const { connectionEvents: _connectionEvents, ...restOpts } = opts ?? {};
  const baseOpts = { ...restOpts, from };

  if (opts?.connectionEvents) {
    for await (const event of connectToStream({ ...baseOpts, connectionEvents: true })) {
      if (event.type === "stream:connected" || event.type === "stream:disconnected") {
        yield event;
        continue;
      }
      await persistSyncEvent(event);
      yield event;
    }
    return;
  }

  for await (const event of connectToStream(baseOpts)) {
    await persistSyncEvent(event);
    yield event;
  }
}

async function persistSyncEvent(event: ItemEvent): Promise<void> {
  if (event.type === EventType.CHANGED) {
    await createOrUpdateItem({
      id: event.item.id.toString("base64url"),
      sourceType: event.item.sourceType,
      ref: event.item.ref,
      collection: event.item.collection,
      changedAt: event.item.changedAt,
      props: event.item.props,
      content: event.item.content,
    });
  } else if (event.type === EventType.DELETED) {
    await deleteItem(event.item.toString("base64url"));
  }

  await setSyncIndex(event.index);
}
