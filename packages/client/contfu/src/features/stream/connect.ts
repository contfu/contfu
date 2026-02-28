import { connectToStream, type ItemEvent, type StreamEvent } from "@contfu/client";
import { EventType } from "@contfu/core";
import { createOrUpdateItem } from "../items/createOrUpdateItem";
import { deleteItem } from "../items/deleteItem";
import { getSyncIndex } from "../sync/getSyncIndex";
import { setSyncIndex } from "../sync/setSyncIndex";
import { processAssets, processPropertyAssets } from "../assets/processAssets";
import { deleteAssetsByItem } from "../assets/deleteAssetsByItem";
import { setCollection } from "../collections/setCollection";
import { renameCollection } from "../collections/renameCollection";
import { removeCollectionByName } from "../collections/removeCollectionByName";
import { getCollectionSchemaByName } from "../collections/getCollectionSchemaByName";
import type {
  CollectionVariants,
  MediaConstraints,
  MediaOptimizer,
  MediaStore,
  VariantDef,
} from "../media/media";
import { mediaStore as defaultMediaStore } from "../../infra/media/media-defaults";

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
  mediaStore?: MediaStore;
  mediaOptimizer?: MediaOptimizer;
  mediaConstraints?: MediaConstraints;
  collectionVariants?: CollectionVariants;
}): AsyncGenerator<ItemEvent | StreamEvent> {
  const persistedFrom = await getSyncIndex();
  const from = opts?.from ?? (persistedFrom != null ? persistedFrom + 1 : undefined);
  const {
    connectionEvents: _connectionEvents,
    mediaStore: userMediaStore,
    mediaOptimizer,
    mediaConstraints,
    collectionVariants,
    ...restOpts
  } = opts ?? {};
  const resolvedMediaStore = userMediaStore ?? defaultMediaStore;
  const baseOpts = { ...restOpts, from };

  if (opts?.connectionEvents) {
    for await (const event of connectToStream({ ...baseOpts, connectionEvents: true })) {
      if (
        event.type === EventType.STREAM_CONNECTED ||
        event.type === EventType.STREAM_DISCONNECTED ||
        event.type === EventType.SNAPSHOT_START ||
        event.type === EventType.SNAPSHOT_END
      ) {
        yield event;
        continue;
      }
      await persistSyncEvent(
        event,
        resolvedMediaStore,
        mediaOptimizer,
        mediaConstraints,
        collectionVariants,
      );
      yield event;
    }
    return;
  }

  for await (const event of connectToStream(baseOpts)) {
    await persistSyncEvent(
      event,
      resolvedMediaStore,
      mediaOptimizer,
      mediaConstraints,
      collectionVariants,
    );
    yield event;
  }
}

async function persistSyncEvent(
  event: ItemEvent,
  mediaStore?: MediaStore,
  mediaOptimizer?: MediaOptimizer,
  mediaConstraints?: MediaConstraints,
  collectionVariants?: CollectionVariants,
): Promise<void> {
  if (event.type === EventType.COLLECTION_SCHEMA) {
    setCollection(event.collection, event.displayName, event.schema);
    return;
  }

  if (event.type === EventType.COLLECTION_RENAMED) {
    renameCollection(event.oldName, event.newName, event.newDisplayName);
    return;
  }

  if (event.type === EventType.COLLECTION_REMOVED) {
    removeCollectionByName(event.collection);
    return;
  }

  if (event.type === EventType.ITEM_CHANGED) {
    const itemId = event.item.id.toString("base64url");
    let content = event.item.content;
    let props = event.item.props;
    const collection = event.item.collection;
    const variants: VariantDef[] | undefined = collectionVariants?.[collection];

    // Create item first so FK constraint is satisfied
    await createOrUpdateItem({
      id: itemId,
      sourceType: event.item.sourceType,
      ref: event.item.ref,
      collection,
      changedAt: event.item.changedAt,
      props,
      content,
    });

    if (mediaStore) {
      let needsUpdate = false;

      if (content && content.length > 0) {
        content = await processAssets({
          itemId,
          content,
          mediaStore,
          mediaOptimizer,
          mediaConstraints,
          collectionVariants: variants,
        });
        needsUpdate = true;
      }

      // Process property assets (cover, icon, files, etc.)
      const schema = getCollectionSchemaByName(collection);
      if (schema && props) {
        props = await processPropertyAssets({
          itemId,
          props,
          schema,
          mediaStore,
          mediaOptimizer,
          mediaConstraints,
          collectionVariants: variants,
        });
        needsUpdate = true;
      }

      if (needsUpdate) {
        await createOrUpdateItem({
          id: itemId,
          sourceType: event.item.sourceType,
          ref: event.item.ref,
          collection,
          changedAt: event.item.changedAt,
          props,
          content,
        });
      }
    }
  } else if (event.type === EventType.ITEM_DELETED) {
    const itemId = event.item.toString("base64url");
    if (mediaStore) {
      await deleteAssetsByItem(itemId);
    }
    await deleteItem(itemId);
  }

  await setSyncIndex(event.index);
}
