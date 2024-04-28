import { ImageBlock } from "../blocks/blocks";
import { MediaOptimizer, MediaStore } from "../media/media";
import { PageData } from "../pages/data/page-data";
import { updateConnections } from "./data/connection-repository";

export async function setConnections(connections: Connection[]): Promise<void> {
  await updateConnections(connections);
}

export type Connection<Collection extends string = string> = {
  /**
   * The id of the connection. It is unique and auto-incremented. It is used to
   * reference the connection in the database.
   */
  id: number;
  /**
   * The name of the connection. It identies the connection and if it changes,
   * all related content will be removed and re-synchronized.
   */
  name: string;
  /**
   * The collections to synchronize with the connection.
   */
  collectionNames: Collection[];
  /**
   * The store where media is stored.
   */
  mediaStore: MediaStore;
  /**
   * The processor to optimize media.
   */
  mediaOptimizer?: MediaOptimizer;
  /**
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  pullCollectionRefs(collection: Collection): AsyncGenerator<string[]>;
  /**
   * Pulls content from the connection target.
   */
  pull(collection: Collection): AsyncGenerator<{
    page: Omit<PageData, "id">;
    assets: { block: ImageBlock; ref: string }[];
  }>;
  /**
   * Fetches an asset from the connection target.
   *
   * @param ref The reference to the asset.
   */
  fetchAsset(ref: string): Promise<ReadableStream>;
};
