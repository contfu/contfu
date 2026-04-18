import { connectToStream, type ItemEvent, type StreamEvent } from "@contfu/connect";
import { EventType } from "@contfu/core";
import { createOrUpdateItem } from "../items/createOrUpdateItem";
import { deleteItem } from "../items/deleteItem";
import { deleteOutgoingItemLinks } from "../items/deleteOutgoingItemLinks";
import { extractLinks, replacePlaceholders } from "../items/extractLinks";
import { getSyncIndex } from "../sync/getSyncIndex";
import { setSyncIndex } from "../sync/setSyncIndex";
import { processFiles, processPropertyFiles } from "../files/processFiles";
import { deleteFilesByItem } from "../files/deleteFilesByItem";
import { setCollection } from "../collections/setCollection";
import { renameCollection } from "../collections/renameCollection";
import { removeCollectionByName } from "../collections/removeCollectionByName";
import { getCollectionSchemaByName } from "../collections/getCollectionSchemaByName";
import { db } from "../../infra/db/db";
import { collectionsTable, linkTable } from "../../infra/db/schema";
import type {
  MediaConvertOpts,
  MediaOptimizer,
  MediaVariants,
  MediaVariantsConfig,
  TransformMediaRule,
} from "../../domain/media";
import type { FileStore } from "../../domain/files";
import { fileStore as defaultFileStore } from "../../infra/media/media-defaults";

/**
 * Connect to the stream and persist events into the local database.
 * The authentication key is read from CONTFU_KEY (base64url) by default.
 */
export async function* connect<CMap = unknown>(opts?: {
  key?: Buffer;
  from?: number;
  reconnect?: boolean;
  connectionEvents?: boolean;
  fileStore?: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule<CMap>[];
  mediaVariants?: MediaVariants<CMap>;
}): AsyncGenerator<ItemEvent | StreamEvent> {
  const persistedFrom = getSyncIndex();
  const from = opts?.from ?? (persistedFrom != null ? persistedFrom + 1 : undefined);
  const {
    connectionEvents: _connectionEvents,
    fileStore: userFileStore,
    mediaOptimizer,
    transformMedia,
    mediaVariants,
    ...restOpts
  } = opts ?? {};
  const resolvedFileStore = userFileStore ?? defaultFileStore;
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
        resolvedFileStore,
        mediaOptimizer,
        transformMedia,
        mediaVariants,
      );
      yield event;
    }
    return;
  }

  for await (const event of connectToStream(baseOpts)) {
    await persistSyncEvent(event, resolvedFileStore, mediaOptimizer, transformMedia, mediaVariants);
    yield event;
  }
}

function resolvePregenerate<CMap>(
  collection: string,
  mediaVariants?: MediaVariants<CMap>,
): MediaConvertOpts[] | undefined {
  if (!mediaVariants) return undefined;
  const byCollection = mediaVariants.collections as Record<string, MediaVariantsConfig> | undefined;
  const config = byCollection?.[collection] ?? mediaVariants.default;
  if (!config?.pregenerate?.length) return undefined;
  const resolved: MediaConvertOpts[] = [];
  for (const name of config.pregenerate) {
    const preset = config.presets[name];
    if (preset) resolved.push(preset);
  }
  return resolved.length > 0 ? resolved : undefined;
}

async function persistSyncEvent<CMap>(
  event: ItemEvent,
  fileStore?: FileStore,
  mediaOptimizer?: MediaOptimizer,
  transformMedia?: TransformMediaRule<CMap>[],
  mediaVariants?: MediaVariants<CMap>,
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
    const pregenerate = resolvePregenerate(collection, mediaVariants);

    // Ensure collection exists — ITEM_CHANGED may arrive before COLLECTION_SCHEMA during resync
    db.insert(collectionsTable)
      .values({ name: collection, displayName: collection, schema: {} })
      .onConflictDoNothing()
      .run();

    // Delete existing outgoing links (will be re-created from current data)
    deleteOutgoingItemLinks(itemId);

    // Extract links from props (REF/REFS) and content (anchors)
    const schema = getCollectionSchemaByName(collection);
    const extracted = extractLinks(itemIdBuf, props, content, schema);

    // Create/update item before inserting links (linkTable.from has FK → items.id)
    createOrUpdateItem({
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
      createOrUpdateItem({
        id: itemId,
        connectionType: event.item.connectionType,
        ref: event.item.ref,
        collection,
        changedAt: event.item.changedAt,
        props,
        content,
      });
    }

    if (fileStore) {
      let needsUpdate = false;

      if (content && content.length > 0) {
        content = await processFiles({
          itemId,
          content,
          fileStore,
          mediaOptimizer,
          transformMedia,
          collection,
          pregenerate,
        });
        needsUpdate = true;
      }

      // Process property files (cover, icon, files, etc.)
      if (schema && props) {
        props = await processPropertyFiles({
          itemId,
          props,
          schema,
          fileStore,
          mediaOptimizer,
          transformMedia,
          collection,
          pregenerate,
        });
        needsUpdate = true;
      }

      if (needsUpdate) {
        createOrUpdateItem({
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
    if (fileStore) {
      deleteFilesByItem(itemId);
    }
    deleteItem(itemId);
  }

  setSyncIndex(event.index);
}
