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
export { sync } from "./infra/sync/sync";

// Item exports
export {
  createItem,
  createItemLink,
  createOrUpdateItem,
  deleteItem,
  deleteItemLinksByRef,
  deleteItemsByIds,
  deleteOutgoingItemLinks,
  getItem,
  getItemIdsByCollection,
  getItemLinks,
  getItems,
  getLastChangedItem,
  updateItem,
} from "./features/items/item-datasource";
export { type ItemData } from "./features/items/item-types";

// Asset exports
export {
  createAsset,
  deleteAssets,
  deleteAssetsByItem,
  deleteAssetsByPage,
  getAsset,
  getAssetByCanonical,
  getAssetsByItem,
  getAssetsByPage,
  getOrphanAssets,
} from "./features/assets/asset-datasource";
export {
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type OnAssetProgress,
} from "./features/assets/asset-types";

// Connection exports
export { createConnection } from "./features/connections/connection-datasource";
export { type Connection, type PullPayload, type Source, type SyncOptions } from "./features/connections/connections";

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
export {
  getCollectionId,
  getCollectionName,
  getOrCreateCollection,
} from "./features/collections/collection-datasource";
export { countCollections } from "./features/collections/countCollections";
export { countItems } from "./features/items/countItems";
export { hashId } from "./util/crypto";
export { deleteNulls } from "./util/object-helpers";
export { detectRuntime } from "./util/runtime";

/** @deprecated Use itemTable instead. */
export { itemsTable as pageTable } from "./infra/db/schema";
/** @deprecated Use itemLinkTable instead. */
export { linkTable as pageLinkTable } from "./infra/db/schema";
/** @deprecated Use DbItem instead. */
export type { DbItem as DbPage } from "./infra/db/schema";
/** @deprecated Use NewItem instead. */
export type { NewItem as NewPage } from "./infra/db/schema";
/** @deprecated Use ItemUpdate instead. */
export type { ItemUpdate as PageUpdate } from "./infra/db/schema";
/** @deprecated Use DbItemLink instead. */
export type { DbItemLink as DbPageLink } from "./infra/db/schema";
/** @deprecated Use NewItemLink instead. */
export type { NewItemLink as NewPageLink } from "./infra/db/schema";
/** @deprecated Use ItemLinkUpdate instead. */
export type { ItemLinkUpdate as PageLinkUpdate } from "./infra/db/schema";
/** @deprecated Use ItemData instead. */
export type { ItemData as PageData } from "./features/items/item-types";

/** @deprecated Use getItems instead. */
export { getItems as getPages } from "./features/items/item-datasource";
/** @deprecated Use getItem instead. */
export { getItem as getPage } from "./features/items/item-datasource";
/** @deprecated Use getLastChangedItem instead. */
export { getLastChangedItem as getLastChangedPage } from "./features/items/item-datasource";
/** @deprecated Use createOrUpdateItem instead. */
export { createOrUpdateItem as createOrUpdatePage } from "./features/items/item-datasource";
/** @deprecated Use createItem instead. */
export { createItem as createPage } from "./features/items/item-datasource";
/** @deprecated Use updateItem instead. */
export { updateItem as updatePage } from "./features/items/item-datasource";
/** @deprecated Use deleteItem instead. */
export { deleteItem as deletePage } from "./features/items/item-datasource";
/** @deprecated Use deleteItemsByIds instead. */
export { deleteItemsByIds as deletePagesByIds } from "./features/items/item-datasource";
/** @deprecated Use getItemIdsByCollection instead. */
export { getItemIdsByCollection as getPageIdsByCollection } from "./features/items/item-datasource";
/** @deprecated Use getItemLinks instead. */
export { getItemLinks as getPageLinks } from "./features/items/item-datasource";
/** @deprecated Use createItemLink instead. */
export { createItemLink as createPageLink } from "./features/items/item-datasource";
/** @deprecated Use deleteOutgoingItemLinks instead. */
export { deleteOutgoingItemLinks as deleteOutgoingPageLinks } from "./features/items/item-datasource";
/** @deprecated Use deleteItemLinksByRef instead. */
export { deleteItemLinksByRef as deletePageLinksByRef } from "./features/items/item-datasource";
