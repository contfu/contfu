/** Maximum number of collections to sync in a single sync operation. */
export const MAX_COLLECTION_PULL_SIZE = Number(
  process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000
);
/** Minimum fetch interval in milliseconds. */
export const MIN_FETCH_INTERVAL = Number(
  process.env.MIN_FETCH_INTERVAL ?? 10_000
);
