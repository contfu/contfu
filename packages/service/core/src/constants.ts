/** Source type identifiers. */
export const SourceType = {
  NOTION: 0,
  STRAPI: 1,
  WEB: 2,
} as const;

/**
 * Message types for communication between the app service and the sync worker.
 * App -> Worker messages use values 1-99.
 * Worker -> App messages use values 100+.
 */
export enum SyncMessageType {
  // App -> Worker
  SHUTDOWN = 5,

  // Worker -> App
  WORKER_READY = 100,
  ITEMS_FETCHED = 101,
}
