import { SourceType } from "../data/data";
import { AsyncQueue } from "../util/async/async-queue";
import { ItemEvent } from "./events";

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
  since?: number;
}

export abstract class Source {
  protected queue = new AsyncQueue<ItemEvent>();

  /** Provides events from the source. */
  events = this.queue.createGenerator();

  /**
   * Pulls events from the connection target.
   * Note: Change events need to be sorted by `item.changedAt`.
   **/
  abstract fetch(conf: CollectionFetchOpts): AsyncGenerator<ItemEvent>;
}
