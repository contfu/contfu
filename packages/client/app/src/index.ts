/**
 * @contfu/app - Full application wrapper
 */

export {
  // Database exports
  db,
  itemTable,
  itemLinkTable,
  assetTable,
  type DbItem,
  type NewItem,
  type ItemUpdate,
  type DbItemLink,
  type NewItemLink,
  type ItemLinkUpdate,
  type DbAsset,
  type NewAsset,
  type AssetUpdate,
  // Stream exports
  connect,
  type ItemEvent,
  // Sync exports
  sync,
  type SyncOptions,
  type SyncSource,
  // Item exports
  type ItemData,
  type ItemLinks,
  getItems,
  getItem,
  getLastChangedItem,
  createOrUpdateItem,
  createItem,
  updateItem,
  deleteItem,
  deleteItemsByIds,
  getItemIdsByCollection,
  getItemLinks,
  createItemLink,
  deleteOutgoingItemLinks,
  deleteItemLinksByRef,
  // Asset exports
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type OnAssetProgress,
  createAsset,
  getAssetsByItem,
  deleteAssetsByItem,
  getOrphanAssets,
  deleteAssets,
  getAsset,
  getAssetByCanonical,
  // Media exports
  type MediaStore,
  // Hooks exports
  createEventHandler,
  composeHandlers,
  type EventHandler,
  type HookOptions,
  // Utility exports
  detectRuntime,
  deleteNulls,
  hashId,
} from "contfu";
