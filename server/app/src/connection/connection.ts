import { PageData, PageValidationError } from "@contfu/core";
import { Observable } from "rxjs";

export type Connection<Collection extends string = string> = {
  id: string;
  /**
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  pullCollectionRefs(collection: Collection): Observable<string[]>;
  /**
   * Pulls content from the connection target.
   */
  pull(
    collection: Collection,
    since?: number
  ): Observable<PageData | PageValidationError>;
  // TODO: Move to client
  /**
   * Fetches an asset from the connection target.
   *
   * @param ref The reference to the asset.
   */
  fetchAsset(
    ref: string
  ): Promise<ReadableStream | Buffer> | ReadableStream | Buffer;
};
