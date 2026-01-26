/**
 * @contfu/app - Full application wrapper
 *
 * This package wraps the contfu package and provides application-level features.
 * All core functionality is re-exported from contfu for backward compatibility.
 */

// Re-export everything from contfu for backward compatibility
export {
  // Database exports
  db,
  pageTable,
  pageLinkTable,
  assetTable,
  type DbPage,
  type NewPage,
  type PageUpdate,
  type DbPageLink,
  type NewPageLink,
  type PageLinkUpdate,
  type DbAsset,
  type NewAsset,
  type AssetUpdate,
  // Sync exports
  sync,
  // Pages exports
  type Page,
  type PageData,
  getPages,
  getPage,
  getLastChangedPage,
  createOrUpdatePage,
  createPage,
  updatePage,
  deletePage,
  deletePagesByIds,
  getPageIdsByCollection,
  getPageLinks,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePageLinksByRef,
  // Assets exports
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type OnAssetProgress,
  createAsset,
  getAssetsByPage,
  deleteAssetsByPage,
  getOrphanAssets,
  deleteAssets,
  getAsset,
  getAssetByCanonical,
  // Connections exports
  type SyncOptions,
  type Source,
  type Connection,
  createConnection,
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

// App-specific functionality
export { connectPush } from "./core/connection";
