export {
  fileTable,
  collectionsTable,
  itemFileTable,
  linkTable as itemLinkTable,
  itemsTable as itemTable,
  mediaVariantTable,
  syncTable,
  type FileUpdate,
  type DbFile,
  type DbItem,
  type DbItemLink,
  type ItemUpdate,
  type NewFile,
  type NewItem,
  type NewItemLink,
} from "./infra/db/schema";

// Stream exports
export type {
  CollectionRemovedEvent,
  CollectionRenamedEvent,
  ItemEvent,
  SchemaEvent,
  StreamEvent,
} from "@contfu/connect";
export { connect } from "./features/stream/connect";
export { getSyncIndex } from "./features/sync/getSyncIndex";
export { setSyncIndex } from "./features/sync/setSyncIndex";

// Item exports
export { createItem } from "./features/items/createItem";
export { createItemLink } from "./features/items/createItemLink";
export { createOrUpdateItem } from "./features/items/createOrUpdateItem";
export { deleteItem } from "./features/items/deleteItem";
export { deleteItemLinksByRef } from "./features/items/deleteItemLinksByRef";
export { deleteItemsByIds } from "./features/items/deleteItemsByIds";
export { deleteOutgoingItemLinks } from "./features/items/deleteOutgoingItemLinks";
export { getItem } from "./features/items/getItem";
export { getItemIdsByCollection } from "./features/items/getItemIdsByCollection";
export { getItemLinks } from "./features/items/getItemLinks";
export { getItemsByIds } from "./features/items/getItemsByIds";
export { getLastChangedItem } from "./features/items/getLastChangedItem";
export {
  queryItems,
  type ItemPropFilter,
  type ItemPropFilterOperator,
  type ItemSortField,
  type QueryItemsInput,
  type QueryItemsResult,
  type SortDirection,
} from "./features/items/queryItems";
export { updateItem } from "./features/items/updateItem";

// Filter helpers
export {
  all,
  and,
  contains,
  createItemRef,
  eq,
  gt,
  gte,
  isFieldRef,
  like,
  linkedFrom,
  linksTo,
  lt,
  lte,
  ne,
  notLike,
  oneOf,
  or,
  type FieldRef,
  type ItemRef,
} from "@contfu/core";

// Query types
export {
  QueryResultArray,
  type IncludeOption,
  type QueryMeta,
  type QueryOptions,
  type SortOption,
  type WithClause,
} from "@contfu/core";

// Query API exports
export {
  type InferRels,
  type ItemWithRelations,
  type PickFields,
  type QuerySystemFields,
  type QueryResult,
  type SelectableField,
  type TypedAllFn,
  type TypedContfuClient,
  type TypedOneOfFn,
  type TypedItem,
  type TypedQueryEntry,
  type TypedQueryResult,
  type TypedQueryResultWithRels,
  type TypedWithEntry,
  type TypedWithInput,
} from "./domain/query-types";
export { findItems } from "./features/items/findItems";
export { getItemById } from "./features/items/getItemById";
// File exports
export { createFile } from "./features/files/createFile";
export { deleteFiles } from "./features/files/deleteFiles";
export { deleteFilesByItem } from "./features/files/deleteFilesByItem";
export { getFile } from "./features/files/getFile";
export { getFilesByItem } from "./features/files/getFilesByItem";
export { getOrphanFiles } from "./features/files/getOrphanFiles";
export { linkFileToItem } from "./features/files/linkFileToItem";

// Shared client data types
export {
  type FileData,
  type FileReference,
  type FileSyncProgress,
  type ContentLinks,
  type ItemData,
  type OnFileProgress,
  type ResolvedLink,
} from "./infra/types/content-types";

// HTTP exports
export { getFileStore, getMediaOptimizer } from "./infra/http";

// Contfu factory
export { contfu, type ContfuInstance, type ContfuOptions, type SyncEvent } from "./contfu";

// Media exports
export { convertMedia } from "./features/media/convertMedia";
export { FileLoadError, loadFile, type LoadFileOptions } from "./features/files/loadFile";
export { type FileStore } from "./domain/files";
export {
  type AudioConstraints,
  type AudioFormat,
  type CollectionVariants,
  type ImageConstraints,
  type ImageFormat,
  type MediaConvertOpts,
  type MediaOptimizer,
  type MediaTransform,
  type OptimizeAudioOpts,
  type OptimizeImageOpts,
  type OptimizeVideoOpts,
  type TransformMediaRule,
  type VariantDef,
  type VariantResult,
  type VideoConstraints,
  type VideoFormat,
} from "./domain/media";
export { DBStore } from "./infra/media/db-store";
export { fileStore } from "./infra/media/media-defaults";

// Hooks exports
export {
  composeHandlers,
  createEventHandler,
  type EventHandler,
  type HookOptions,
} from "./infra/hooks/event-hooks";

// Collection exports
export { generateTypes } from "./features/collections/generateTypes";
export { getAllCollectionSchemas } from "./features/collections/getAllCollectionSchemas";
export { getCollectionSchemaByName } from "./features/collections/getCollectionSchemaByName";
export { setCollection } from "./features/collections/setCollection";

// Utility exports
export { countFiles, countDownloadedFiles, countProcessedFiles } from "./features/files/countFiles";
export { countCollections } from "./features/collections/countCollections";
export { listCollections, type CollectionSummary } from "./features/collections/listCollections";
export { countItems } from "./features/items/countItems";
export { deleteNulls } from "./util/object-helpers";
export { detectRuntime } from "./util/runtime";
