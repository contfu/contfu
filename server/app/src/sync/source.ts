import { CollectionSchema } from "@contfu/core";
import { Observable } from "rxjs";
import { SourceType } from "../data/data";
import { ItemEvent } from "./events";

export interface CollectionFetchOpts {
  type: SourceType;
  account: number;
  source: number;
  collection: number;
  /** Reference to the upstream collection within the source. */
  ref?: Buffer;
  /** Optional URL for the source. SaaS sources don't have a configurable URL. */
  url?: string;
  /** Can be an API key or other credentials. */
  credentials?: Buffer;
  /** Since when (exclusive) to pull events. The default is all time. */
  since?: number;
}

export interface Source {
  /**
   * Pulls events from the remote source.
   * Note: Change events need to be sorted ascending by `item.createdAt`.
   **/
  fetch(opts: CollectionFetchOpts): Observable<ItemEvent>;

  /**
   * Returns the schema of the collection.
   */
  getCollectionSchema(opts: CollectionFetchOpts): Promise<CollectionSchema>;
}
