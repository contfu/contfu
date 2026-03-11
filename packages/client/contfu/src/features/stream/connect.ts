import { connectToStream, type ItemEvent, type StreamEvent } from "@contfu/client";
import { EventType } from "@contfu/core";
import { createOrUpdateItem } from "../items/createOrUpdateItem";
import { deleteItem } from "../items/deleteItem";
import { deleteOutgoingItemLinks } from "../items/deleteOutgoingItemLinks";
import { extractLinks, replacePlaceholders } from "../items/extractLinks";
import { getSyncIndex } from "../sync/getSyncIndex";
import { setSyncIndex } from "../sync/setSyncIndex";
import { processAssets, processPropertyAssets } from "../assets/processAssets";
import { deleteAssetsByItem } from "../assets/deleteAssetsByItem";
import { setCollection } from "../collections/setCollection";
import { renameCollection } from "../collections/renameCollection";
import { removeCollectionByName } from "../collections/removeCollectionByName";
import { getCollectionSchemaByName } from "../collections/getCollectionSchemaByName";
import { db } from "../../infra/db/db";
import { collectionsTable, linkTable } from "../../infra/db/schema";
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
    const itemIdBuf = event.item.id;
    const itemId = itemIdBuf.toString("base64url");
    let content = event.item.content;
    let props = event.item.props;
    const collection = event.item.collection;
    const variants: VariantDef[] | undefined = collectionVariants?.[collection];

    // Ensure collection exists — ITEM_CHANGED may arrive before COLLECTION_SCHEMA during resync
    db.insert(collectionsTable)
      .values({ name: collection, displayName: collection, schema: {} })
      .onConflictDoNothing()
      .run();

    // Delete existing outgoing links (will be re-created from current data)
    await deleteOutgoingItemLinks(itemId);

    // Extract links from props (REF/REFS) and content (anchors)
    const schema = getCollectionSchemaByName(collection);
    const extracted = extractLinks(itemIdBuf, props, content, schema);

    // Create/update item before inserting links (linkTable.from has FK → items.id)
    await createOrUpdateItem({
      id: itemId,
      connectionType: event.item.connectionType,
      ref: event.item.ref,
      collection,
      changedAt: event.item.changedAt,
      props,
      content,
    });

    // Insert link records and get auto-increment IDs
    let linkIds: number[] = [];
    if (extracted.records.length > 0) {
      linkIds = extracted.records.map(
        (rec) => db.insert(linkTable).values(rec).returning({ id: linkTable.id }).get().id,
      );
    }

    // Replace placeholder indices with actual link IDs
    const resolved = replacePlaceholders(extracted.props, extracted.content, schema, linkIds);
    props = resolved.props;
    content = resolved.content ?? undefined;

    // Update item with resolved props/content (link IDs substituted in)
    if (extracted.records.length > 0) {
      await createOrUpdateItem({
        id: itemId,
        connectionType: event.item.connectionType,
        ref: event.item.ref,
        collection,
        changedAt: event.item.changedAt,
        props,
        content,
      });
    }

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
          connectionType: event.item.connectionType,
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
