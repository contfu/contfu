/** Maximum number of collections to sync in a single sync operation. */
export const MAX_COLLECTION_PULL_SIZE = Number(
  Bun.env.MAX_COLLECTION_PULL_SIZE ?? 10_000
);
/** Minimum fetch interval in milliseconds. */
export const MIN_FETCH_INTERVAL = Number(Bun.env.MIN_FETCH_INTERVAL ?? 10_000);
