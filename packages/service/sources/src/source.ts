import { CollectionSchema, Item } from "@contfu/core";

export type CollectionFetchOpts = {
  /** The database id of the collection. */
  collection: number;
  /** Reference to the upstream collection within the source. */
  ref?: Buffer;
  /** Optional URL for the source. SaaS sources don't have a configurable URL. */
  url?: string;
  /** Can be an API key (string) or encrypted credentials (Buffer). */
  credentials?: string | Buffer;
  /** Since when (exclusive) to pull events. The default is all time. */
  since?: number;
};

export interface Source<T extends CollectionFetchOpts = CollectionFetchOpts> {
  /**
   * Pulls events from the remote source.
   * Note: Change events need to be sorted ascending by `item.createdAt`.
   **/
  fetch(opts: T): AsyncGenerator<Item>;

  /**
   * Returns the schema of the collection.
   */
  getCollectionSchema(opts: T): Promise<CollectionSchema>;
}
