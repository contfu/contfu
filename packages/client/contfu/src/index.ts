/**
 * @contfu/contfu - Main entry point
 */

// Database exports
export { db } from "./infra/db/db";
export {
  assetTable,
  linkTable as itemLinkTable,
  itemsTable as itemTable,
  type AssetUpdate,
  type DbAsset,
  type DbItem,
  type DbItemLink,
  type ItemLinkUpdate,
  type ItemUpdate,
  type NewAsset,
  type NewItem,
  type NewItemLink,
} from "./infra/db/schema";

// Sync exports
export { sync, type SyncOptions, type SyncSource } from "./infra/sync/sync";

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
export { getItems } from "./features/items/getItems";
export { getLastChangedItem } from "./features/items/getLastChangedItem";
export { updateItem } from "./features/items/updateItem";

// Asset exports
export { createAsset } from "./features/assets/createAsset";
export { deleteAssets } from "./features/assets/deleteAssets";
export { deleteAssetsByItem } from "./features/assets/deleteAssetsByItem";
export { getAsset } from "./features/assets/getAsset";
export { getAssetByCanonical } from "./features/assets/getAssetByCanonical";
export { getAssetsByItem } from "./features/assets/getAssetsByItem";
export { getOrphanAssets } from "./features/assets/getOrphanAssets";

// Shared client data types
export {
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type ItemData,
  type ItemLinks,
  type OnAssetProgress,
} from "./infra/types/content-types";

// Media exports
export {
  type ImageFormat,
  type MediaOptimizer,
  type MediaStore,
  type OptimizeImageOpts,
} from "./features/media/media";

// Hooks exports
export {
  composeHandlers,
  createEventHandler,
  type EventHandler,
  type HookOptions,
} from "./infra/hooks/event-hooks";

// Utility exports
export { countAssets } from "./features/assets/countAssets";
export { getCollectionId } from "./features/collections/getCollectionId";
export { getCollectionName } from "./features/collections/getCollectionName";
export { getOrCreateCollection } from "./features/collections/getOrCreateCollection";
export { countCollections } from "./features/collections/countCollections";
export { countItems } from "./features/items/countItems";
export { hashId } from "./util/crypto";
export { deleteNulls } from "./util/object-helpers";
export { detectRuntime } from "./util/runtime";
