/** Maximum number of collections to sync in a single sync operation. */
export const MAX_COLLECTION_PULL_SIZE = Number(
  Bun.env.MAX_COLLECTION_PULL_SIZE ?? 10_000
);
/** Minimum sync interval in milliseconds. */
export const MIN_SYNC_INTERVAL = Number(Bun.env.MIN_SYNC_INTERVAL ?? 10_000);
/** Number of sync workers to run. */
export const SYNC_WORKERS = Number(Bun.env.SYNC_WORKERS ?? 1);
