export {
  assetTable,
  collectionsTable,
  itemAssetTable,
  linkTable as itemLinkTable,
  itemsTable as itemTable,
  mediaVariantTable,
  syncTable,
  type AssetUpdate,
  type DbAsset,
  type DbItem,
  type DbItemLink,
  type ItemUpdate,
  type NewAsset,
  type NewItem,
  type NewItemLink,
} from "./infra/db/schema";

// Stream exports
export type {
  CollectionRemovedEvent,
  CollectionRenamedEvent,
  ItemEvent,
  SchemaEvent,
} from "@contfu/client";
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
  eq,
  gt,
  gte,
  like,
  linkedFrom,
  linksTo,
  lt,
  lte,
  ne,
  notLike,
  oneOf,
  or,
  type ItemRef,
} from "./domain/filter-helpers";

// Query API exports
export { contfu } from "./contfu";
export type { ContfuConfig } from "./contfu";
export {
  QueryResultArray,
  type IncludeOption,
  type InferRels,
  type ItemWithRelations,
  type PickFields,
  type QueryMeta,
  type QueryOptions,
  type QuerySystemFields,
  type QueryResult,
  type SelectableField,
  type SortOption,
  type TypedAllFn,
  type TypedContfuClient,
  type TypedOneOfFn,
  type TypedItem,
  type TypedQueryEntry,
  type TypedQueryResult,
  type TypedQueryResultWithRels,
  type TypedWithEntry,
  type TypedWithInput,
  type WithClause,
} from "./domain/query-types";
export { findItems } from "./features/items/findItems";
export { getItemById } from "./features/items/getItemById";
// Asset exports
export { createAsset } from "./features/assets/createAsset";
export { deleteAssets } from "./features/assets/deleteAssets";
export { deleteAssetsByItem } from "./features/assets/deleteAssetsByItem";
export { getAsset } from "./features/assets/getAsset";
export { getAssetsByItem } from "./features/assets/getAssetsByItem";
export { getOrphanAssets } from "./features/assets/getOrphanAssets";
export { linkAssetToItem } from "./features/assets/linkAssetToItem";

// Shared client data types
export {
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type ContentLinks,
  type ItemData,
  type OnAssetProgress,
  type ResolvedLink,
} from "./infra/types/content-types";

// Media exports
export { convertMedia } from "./features/media/convertMedia";
export {
  type AudioConstraints,
  type AudioFormat,
  type CollectionVariants,
  type ImageConstraints,
  type ImageFormat,
  type MediaConvertOpts,
  type MediaOptimizer,
  type MediaStore,
  type MediaTransform,
  type OptimizeAudioOpts,
  type OptimizeImageOpts,
  type OptimizeVideoOpts,
  type TransformMediaRule,
  type VariantDef,
  type VariantResult,
  type VideoConstraints,
  type VideoFormat,
} from "./features/media/media";
export { DBStore } from "./infra/media/db-store";
export { mediaStore } from "./infra/media/media-defaults";

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
export {
  countAssets,
  countDownloadedAssets,
  countProcessedAssets,
} from "./features/assets/countAssets";
export { countCollections } from "./features/collections/countCollections";
export { listCollections, type CollectionSummary } from "./features/collections/listCollections";
export { countItems } from "./features/items/countItems";
export { deleteNulls } from "./util/object-helpers";
export { detectRuntime } from "./util/runtime";
