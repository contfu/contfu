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
import { processFilesSync, processPropertyFilesSync } from "./shared/files/processFiles";
import { deleteFilesByItem } from "./features/files/deleteFilesByItem";
import { pruneItemFiles } from "./features/files/pruneItemFiles";
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
 * Run the Contfu runtime: use the Connector to receive Sync Messages,
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
    key: suppliedKey,
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
  const applicationKey = suppliedKey ?? resolveApplicationKey();
  let activeStream: {
    resolveFileLease: (
      integrationType: number,
      sourceCollectionId: string,
      itemId: string | number,
      handle: string,
    ) => Promise<{ url: string; expiresAt: number } | null>;
  } | null = null;
  const mediaRepair = createMediaRepairCoordinator();
  if (localFiles) {
    configureMediaQueue({
      fileStore: resolvedFileStore,
      mediaOptimizer,
      mediaMaster,
      transformMedia: transformMedia as TransformMediaRule[],
      mediaVariants: mediaVariants as MediaVariants,
      concurrency: mediaQueueConcurrency,
      applicationKey,
      contfuOrigin: resolveContfuOrigin(),
      onCloudRepair: (request) =>
        mediaRepair.repair(request.collection, request.itemIds, request.source),
      resolveFileLease: async (stableUrl) => {
        if (!activeStream) return null;
        try {
          const parsed = new URL(stableUrl);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length !== 6 || parts[0] !== "api" || parts[1] !== "files") return null;
          const integrationType = Number(parts[2]);
          const sourceCollectionId = parts[3];
          const itemId = parts[4];
          if (!Number.isSafeInteger(integrationType) || !sourceCollectionId || !itemId) return null;
          return await activeStream.resolveFileLease(
            integrationType,
            sourceCollectionId,
            itemId,
            parts[5],
          );
        } catch {
          return null;
        }
      },
    });
    await reconcileConfiguredMediaMasters();
  }
  const baseOpts = {
    ...restOpts,
    ...(applicationKey ? { key: applicationKey } : {}),
  };

  if (opts?.connectionEvents) {
    const stream = connectToStream({ ...baseOpts, connectionEvents: true });
    activeStream = {
      resolveFileLease: (...args) => stream.resolveFileLease!(...args),
    };
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
      persistSyncEvent(
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
  activeStream = {
    resolveFileLease: (...args) => stream.resolveFileLease!(...args),
  };
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
    persistSyncEvent(
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

function resolveApplicationKey(): Buffer | undefined {
  const key = process.env.CONTFU_KEY;
  return key ? Buffer.from(key, "base64url") : undefined;
}

function resolveContfuOrigin(): string {
  return new URL(process.env.CONTFU_INTERNAL_CLOUD_URL ?? "https://contfu.com").origin;
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

function insertLinkRecord(record: LinkRecord, ctx = db): number {
  if (record.kind === "internal") {
    return ctx
      .insert(internalLinkTable)
      .values({ prop: record.prop, from: record.from, to: record.to })
      .returning({ id: internalLinkTable.id })
      .get().id;
  }

  const next = ctx
    .select({ id: sql<number>`coalesce(min(${externalLinkTable.id}), 0) - 1` })
    .from(externalLinkTable)
    .get()!.id;
  return ctx
    .insert(externalLinkTable)
    .values({ id: next, from: record.from, url: record.url })
    .returning({ id: externalLinkTable.id })
    .get().id;
}

function persistSyncEvent<CMap>(
  event: ItemEvent,
  fileStore?: FileStore,
  mediaOptimizer?: MediaOptimizer,
  transformMedia?: TransformMediaRule<CMap>[],
  mediaVariants?: MediaVariants<CMap>,
  localFiles = true,
): void {
  let resumeQueue = false;
  db.transaction((tx) => {
    if (event.type === EventType.COLLECTION_SCHEMA) {
      setCollection(event.collection, event.displayName, event.schema, event.i18n, tx);
    } else if (event.type === EventType.COLLECTION_RENAMED) {
      renameCollection(event.oldName, event.newName, event.newDisplayName, tx);
    } else if (event.type === EventType.COLLECTION_REMOVED) {
      removeCollectionByName(event.collection, tx);
    } else if (event.type === EventType.ITEM_CHANGED) {
      const itemId = event.item.id;
      let content = event.item.content;
      let props = event.item.props;
      const collection = event.item.collection;
      const pregenerate = resolvePregenerate(collection, mediaVariants);
      const schema = getCollectionSchemaByName(collection, tx);
      if (!schema)
        throw new Error(
          `Received ITEM_CHANGED for unknown collection "${collection}" before schema`,
        );
      deleteOutgoingItemLinks(itemId, tx);
      const extracted = extractLinks(event.item.id, props, content, schema);
      createOrUpdateItem(
        { id: itemId, collection, changedAt: event.item.changedAt, props, content },
        tx,
      );
      const linkIds = extracted.records.map((record) => insertLinkRecord(record, tx));
      const resolved = replacePlaceholders(extracted.props, extracted.content, schema, linkIds);
      props = resolved.props;
      content = resolved.content ?? undefined;
      if (extracted.records.length > 0) {
        createOrUpdateItem(
          { id: itemId, collection, changedAt: event.item.changedAt, props, content },
          tx,
        );
      }
      if (fileStore && localFiles) {
        const linked = new Set<string>();
        if (content && content.length > 0) {
          content = processFilesSync({
            itemId,
            content,
            fileStore,
            mediaOptimizer,
            transformMedia,
            collection,
            pregenerate,
            linked,
            ctx: tx,
          });
        }
        if (props) {
          props = processPropertyFilesSync({
            itemId,
            props,
            schema,
            fileStore,
            mediaOptimizer,
            transformMedia,
            collection,
            pregenerate,
            linked,
            ctx: tx,
          });
        }
        pruneItemFiles(itemId, linked, tx);
        createOrUpdateItem(
          { id: itemId, collection, changedAt: event.item.changedAt, props, content },
          tx,
        );
        resumeQueue = true;
      }
    } else if (event.type === EventType.ITEM_DELETED) {
      if (fileStore && localFiles) deleteFilesByItem(event.item, tx);
      deleteItem(event.item, tx);
    }
    setSyncIndex(event.index, tx);
  });
  if (resumeQueue) resumeMediaQueue();
}
