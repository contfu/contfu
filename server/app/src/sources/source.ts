import { CollectionConfig, Item, PageValidationError } from "@contfu/core";
import { Observable } from "rxjs";

export type Source<C extends CollectionConfig> = {
  id: number;
  /**
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  pullCollectionIds(collection: C): Observable<string[]>;
  /**
   * Pulls content from the connection target.
   */
  pull(collection: C, since?: number): Observable<Item | PageValidationError>;
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
