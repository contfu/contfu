import {
  connectToStream,
  type CommandResultEvent,
  type ItemEvent,
  type StreamEvent,
} from "@contfu/connect";
import { CommandResult, EventType } from "@contfu/core";
import { sql } from "drizzle-orm";
import { createOrUpdateItem } from "./features/items/createOrUpdateItem";
import { deleteItem } from "./features/items/deleteItem";
import { deleteOutgoingItemLinks } from "./features/items/deleteOutgoingItemLinks";
import { extractLinks, type LinkRecord } from "./features/items/extractLinks";
import { replacePlaceholders } from "./features/items/replacePlaceholders";
import { setSyncIndex } from "./features/sync/setSyncIndex";
import { configureMediaQueue } from "./features/files/mediaQueue";
import { reconcileConfiguredMediaMasters } from "./features/files/reconcileConfiguredMediaMasters";
import { resumeMediaQueue } from "./features/files/resumeMediaQueue";
import { processFiles } from "./features/files/processFiles";
import { processPropertyFiles } from "./features/files/processPropertyFiles";
import { deleteFilesByItem } from "./features/files/deleteFilesByItem";
import { setCollection } from "./features/collections/setCollection";
import { renameCollection } from "./features/collections/renameCollection";
import { removeCollectionByName } from "./features/collections/removeCollectionByName";
import { getCollectionSchemaByName } from "./features/collections/getCollectionSchemaByName";
import { createMediaRepairCoordinator } from "./features/sync/mediaRepairCoordinator";
import { db } from "./infra/db/db";
import { externalLinkTable, internalLinkTable } from "./infra/db/schema";
import type {
  MediaConvertOpts,
  MediaMasterConfig,
  MediaOptimizer,
  MediaVariants,
  MediaVariantsConfig,
  TransformMediaRule,
} from "./domain/media";
import type { FileStore } from "./domain/files";
import { fileStore as defaultFileStore } from "./infra/media/media-defaults";

/**
 * Run the Local Runtime: use the Connector to receive Sync Messages,
 * apply them into the Local Store, and process Media Files.
 * The authentication key is read from CONTFU_KEY (base64url) by default.
 */
export async function* connect<CMap = unknown>(opts?: {
  key?: Buffer;
  reconnect?: boolean;
  connectionEvents?: boolean;
  fileStore?: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule<CMap>[];
  mediaVariants?: MediaVariants<CMap>;
  mediaMaster?: false | MediaMasterConfig;
  localFiles?: boolean;
  mediaQueueConcurrency?: number;
  commandResults?: boolean;
}): AsyncGenerator<ItemEvent | StreamEvent | CommandResultEvent> {
  const {
    connectionEvents: _connectionEvents,
    fileStore: userFileStore,
    mediaOptimizer,
    transformMedia,
    mediaVariants,
    mediaMaster,
    localFiles = true,
    mediaQueueConcurrency = 2,
    ...restOpts
  } = opts ?? {};
  const resolvedFileStore = userFileStore ?? defaultFileStore;
  const mediaRepair = createMediaRepairCoordinator();
  if (localFiles) {
    configureMediaQueue({
      fileStore: resolvedFileStore,
      mediaOptimizer,
      mediaMaster,
      transformMedia: transformMedia as TransformMediaRule[],
      mediaVariants: mediaVariants as MediaVariants,
      concurrency: mediaQueueConcurrency,
      onCloudRepair: (request) =>
        mediaRepair.repair(request.collection, request.itemIds, request.source),
    });
    await reconcileConfiguredMediaMasters();
  }
  const baseOpts = restOpts;

  if (opts?.connectionEvents) {
    const stream = connectToStream({ ...baseOpts, connectionEvents: true });
    for await (const event of stream) {
      if (event.type === EventType.STREAM_CONNECTED) mediaRepair.connected(stream);
      if (event.type === EventType.STREAM_DISCONNECTED) mediaRepair.disconnected();
      if (event.type === CommandResult.REFRESH || event.type === CommandResult.REFRESH_ALL) {
        yield event;
        continue;
      }
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
        localFiles,
      );
      yield event;
    }
    return;
  }

  const stream = connectToStream({ ...baseOpts, connectionEvents: true });
  for await (const event of stream) {
    if (event.type === EventType.STREAM_CONNECTED) {
      mediaRepair.connected(stream);
      continue;
    }
    if (event.type === EventType.STREAM_DISCONNECTED) {
      mediaRepair.disconnected();
      continue;
    }
    if (event.type === EventType.SNAPSHOT_START || event.type === EventType.SNAPSHOT_END) continue;
    if (event.type === CommandResult.REFRESH || event.type === CommandResult.REFRESH_ALL) {
      yield event;
      continue;
    }
    await persistSyncEvent(
      event,
      resolvedFileStore,
      mediaOptimizer,
      transformMedia,
      mediaVariants,
      localFiles,
    );
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

function insertLinkRecord(record: LinkRecord): number {
  if (record.kind === "internal") {
    return db
      .insert(internalLinkTable)
      .values({ prop: record.prop, from: record.from, to: record.to })
      .returning({ id: internalLinkTable.id })
      .get().id;
  }

  const next = db
    .select({ id: sql<number>`coalesce(min(${externalLinkTable.id}), 0) - 1` })
    .from(externalLinkTable)
    .get()!.id;
  return db
    .insert(externalLinkTable)
    .values({ id: next, from: record.from, url: record.url })
    .returning({ id: externalLinkTable.id })
    .get().id;
}

async function persistSyncEvent<CMap>(
  event: ItemEvent,
  fileStore?: FileStore,
  mediaOptimizer?: MediaOptimizer,
  transformMedia?: TransformMediaRule<CMap>[],
  mediaVariants?: MediaVariants<CMap>,
  localFiles = true,
): Promise<void> {
  if (event.type === EventType.COLLECTION_SCHEMA) {
    setCollection(event.collection, event.displayName, event.schema, event.i18n);
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
    const itemId = event.item.id;
    let content = event.item.content;
    let props = event.item.props;
    const collection = event.item.collection;
    const pregenerate = resolvePregenerate(collection, mediaVariants);

    const schema = getCollectionSchemaByName(collection);
    if (!schema) {
      throw new Error(`Received ITEM_CHANGED for unknown collection "${collection}" before schema`);
    }

    // Delete existing outgoing links (will be re-created from current data)
    deleteOutgoingItemLinks(itemId);

    // Extract links from props (REF/REFS) and content (anchors)
    const extracted = extractLinks(event.item.id, props, content, schema);

    // Create/update item before inserting links (link rows reference items.id)
    createOrUpdateItem({
      id: itemId,
      collection,
      changedAt: event.item.changedAt,
      props,
      content,
    });

    // Insert link records and get auto-increment IDs
    let linkIds: number[] = [];
    if (extracted.records.length > 0) {
      linkIds = extracted.records.map(insertLinkRecord);
    }

    // Replace placeholder indices with actual link IDs
    const resolved = replacePlaceholders(extracted.props, extracted.content, schema, linkIds);
    props = resolved.props;
    content = resolved.content ?? undefined;

    // Update item with resolved props/content (link IDs substituted in)
    if (extracted.records.length > 0) {
      createOrUpdateItem({
        id: itemId,
        collection,
        changedAt: event.item.changedAt,
        props,
        content,
      });
    }

    if (fileStore && localFiles) {
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
          collection,
          changedAt: event.item.changedAt,
          props,
          content,
        });
        resumeMediaQueue();
      }
    }
  } else if (event.type === EventType.ITEM_DELETED) {
    const itemId = event.item;
    if (fileStore && localFiles) {
      deleteFilesByItem(itemId);
    }
    deleteItem(itemId);
  }

  setSyncIndex(event.index);
}
