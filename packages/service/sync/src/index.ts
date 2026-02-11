// This package is now a worker module spawned by the app service.
// The entry point is worker.ts which is loaded by the SyncWorkerManager.
// Re-export types and utilities that may be useful for other packages.

export type { Source, CollectionFetchOpts } from "@contfu/svc-sources";
export { NotionSource, type NotionFetchOpts } from "@contfu/svc-sources/notion";
export { combine2ints, combine3ints } from "./util/numbers/numbers";
export { SortedSet } from "./util/structures/sorted-set";
