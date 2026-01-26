/**
 * @contfu/contfu - Main entry point
 *
 * This package provides the core functionality for the Contfu client,
 * including database management, sync, pages, assets, and connections.
 */

// Database exports
export { db } from "./db/db";
export {
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
} from "./db/schema";

// Sync exports
export { sync } from "./sync/sync";

// Pages exports
export { type Page, type PageData } from "./pages/pages";
export {
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
} from "./pages/page-datasource";

// Assets exports
export {
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type OnAssetProgress,
} from "./assets/asset-types";
export {
  createAsset,
  getAssetsByPage,
  deleteAssetsByPage,
  getOrphanAssets,
  deleteAssets,
  getAsset,
  getAssetByCanonical,
} from "./assets/asset-datasource";

// Connections exports
export { type SyncOptions, type Source, type Connection } from "./connections/connections";
export { createConnection } from "./connections/connection-datasource";

// Media exports
export {
  type MediaStore,
  type MediaOptimizer,
  type ImageFormat,
  type OptimizeImageOpts,
} from "./media/media";

// Hooks exports
export {
  createEventHandler,
  composeHandlers,
  type EventHandler,
  type HookOptions,
} from "./hooks/event-hooks";

// Utility exports
export { detectRuntime } from "./util/runtime";
export { deleteNulls } from "./util/object-helpers";
export { hashId } from "./util/crypto";
