import { ItemEventExtended } from "./events";
import { SourceType } from "./sync";

export interface CollectionFetchOpts {
  type: SourceType;
  accountId: number;
  sourceId: number;
  collectionId: number;
  /** Reference to the upstream collection within the source. */
  ref?: Buffer;
  /** Optional URL for the source. SaaS sources don't have a configurable URL. */
  url?: string;
  /** Can be an API key or other credentials. */
  credentials?: Buffer;
  /** Since when (exclusive) to pull events. The default is all time. */
  since?: Date;
}

export type Source = {
  /** Pulls events from the connection target. */
  fetch(conf: CollectionFetchOpts): AsyncIterable<ItemEventExtended>;
  /** Provides events from the source. */
  events: AsyncIterable<ItemEventExtended>;
};
