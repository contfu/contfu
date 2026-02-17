import type { ImageBlock } from "@contfu/core";
import type { OnAssetProgress } from "../assets/asset-types";
import type { MediaStore } from "../media/media";
import type { ItemData } from "../items/item-types";

export interface SyncOptions {
  onProgress?: OnAssetProgress;
}

export type PullPayload =
  | { item: Omit<ItemData, "id">; assets: { block: ImageBlock; ref: string }[] }
  | { page: Omit<ItemData, "id">; assets: { block: ImageBlock; ref: string }[] };

export interface Source<C extends string = string> {
  id: string;
  collectionNames: C[];
  mediaStore: MediaStore;
  mediaOptimizer?: {
    optimizeImage(store: MediaStore, name: string, asset: ReadableStream): Promise<void>;
  };
  pull(collection: C): AsyncGenerator<PullPayload>;
  pullCollectionRefs(collection: C): AsyncGenerator<string[]>;
  fetchAsset(url: string): Promise<ReadableStream>;
}

export interface Connection<C extends string = string> extends Source<C> {
  name: string;
}
