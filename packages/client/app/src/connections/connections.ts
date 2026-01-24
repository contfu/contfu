import type { ImageBlock } from "@contfu/core";
import type { OnAssetProgress } from "../assets/asset-types";
import type { MediaStore } from "../media/media";
import type { PageData } from "../pages/pages";

/**
 * Options for sync operations.
 */
export interface SyncOptions {
  /** Optional callback to receive progress updates during asset sync */
  onProgress?: OnAssetProgress;
}

export interface Source<C extends string = string> {
  id: string;
  collectionNames: C[];
  mediaStore: MediaStore;
  mediaOptimizer?: {
    optimizeImage(store: MediaStore, name: string, asset: ReadableStream): Promise<void>;
  };
  pull(
    collection: C,
  ): AsyncGenerator<{ page: Omit<PageData, "id">; assets: { block: ImageBlock; ref: string }[] }>;
  pullCollectionRefs(collection: C): AsyncGenerator<string[]>;
  fetchAsset(url: string): Promise<ReadableStream>;
}

export interface Connection<C extends string = string> extends Source<C> {
  name: string;
}
