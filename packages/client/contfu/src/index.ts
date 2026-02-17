/**
 * @contfu/contfu - Main entry point
 *
 * This package provides the core functionality for the Contfu client,
 * including database management, sync, pages, assets, and connections.
 */

// Database exports
export { db } from "./db/db";
export {
  assetTable,
  linkTable as pageLinkTable,
  itemsTable as pageTable,
  type AssetUpdate,
  type DbAsset,
  type DbItem as DbPage,
  type DbPageLink,
  type NewAsset,
  type NewItem as NewPage,
  type NewPageLink,
  type PageLinkUpdate,
  type ItemUpdate as PageUpdate,
} from "./db/schema";

// Sync exports
export { sync } from "./sync/sync";

// Pages exports
export {
  createOrUpdatePage,
  createPage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePage,
  deletePageLinksByRef,
  deletePagesByIds,
  getLastChangedPage,
  getPage,
  getPageIdsByCollection,
  getPageLinks,
  getPages,
  updatePage,
} from "./pages/page-datasource";
export { type PageData } from "./pages/pages";

// Assets exports
export {
  createAsset,
  deleteAssets,
  deleteAssetsByPage,
  getAsset,
  getAssetByCanonical,
  getAssetsByPage,
  getOrphanAssets,
} from "./assets/asset-datasource";
export {
  type Asset,
  type AssetData,
  type AssetReference,
  type AssetSyncProgress,
  type OnAssetProgress,
} from "./assets/asset-types";

// Connections exports
export { createConnection } from "./connections/connection-datasource";
export { type Connection, type Source, type SyncOptions } from "./connections/connections";

// Media exports
export {
  type ImageFormat,
  type MediaOptimizer,
  type MediaStore,
  type OptimizeImageOpts,
} from "./media/media";

// Hooks exports
export {
  composeHandlers,
  createEventHandler,
  type EventHandler,
  type HookOptions,
} from "./hooks/event-hooks";

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
