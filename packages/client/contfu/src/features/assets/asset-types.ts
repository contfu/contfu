import type { ImageBlock } from "@contfu/core";

export interface Asset<T extends { format?: string } = { format: string }> {
  format: T extends { format: infer F } ? F : string;
}

export interface AssetData<A extends Asset = Asset> {
  id: string;
  itemId: string;
  /** @deprecated Use itemId instead. */
  pageId?: string;
  canonical: string;
  originalUrl: string;
  format: A["format"];
  size: number;
  createdAt: number;
}

export interface AssetReference {
  block: ImageBlock;
  ref: string;
}

export interface AssetSyncProgress {
  total: number;
  completed: number;
  current: {
    url: string;
    name: string;
  } | null;
  bytesDownloaded: number;
  bytesTotal: number;
}

export type OnAssetProgress = (progress: AssetSyncProgress) => void;
