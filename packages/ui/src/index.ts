/**
 * @contfu/ui - Full application wrapper
 */

export {
  fileTable,
  composeHandlers,
  // Stream exports
  connect,
  createFile,
  // Hooks exports
  createEventHandler,
  createItem,
  createItemLink,
  createOrUpdateItem,
  // Database exports
  db,
  deleteFiles,
  deleteFilesByItem,
  deleteItem,
  deleteItemLinksByRef,
  deleteItemsByIds,
  deleteNulls,
  deleteOutgoingItemLinks,
  // Utility exports
  detectRuntime,
  getFile,
  getFilesByItem,
  getItem,
  getItemIdsByCollection,
  getItemLinks,
  getLastChangedItem,
  getOrphanFiles,
  itemLinkTable,
  itemTable,
  updateItem,
  // File exports
  type FileData,
  type FileReference,
  type FileSyncProgress,
  type FileUpdate,
  type DbFile,
  type DbItem,
  type DbItemLink,
  type EventHandler,
  type HookOptions,
  // Item exports
  type ItemData,
  type ItemEvent,
  type ContentLinks,
  type ResolvedLink,
  type ItemUpdate,
  // File exports
  type FileStore,
  type NewFile,
  type NewItem,
  type NewItemLink,
  type OnFileProgress,
} from "@contfu/contfu";
