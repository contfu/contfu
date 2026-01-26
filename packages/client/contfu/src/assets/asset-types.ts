import type { ImageBlock } from "@contfu/core";

export interface Asset<T extends { format?: string } = { format: string }> {
  format: T extends { format: infer F } ? F : string;
}

export interface AssetData<A extends Asset = Asset> {
  id: string;
  pageId: string;
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

/**
 * Progress information for asset sync operations.
 * Used to track download progress during bulk asset processing.
 */
export interface AssetSyncProgress {
  /** Total number of assets to process */
  total: number;
  /** Number of assets completed so far */
  completed: number;
  /** Currently processing asset info (null when not actively downloading) */
  current: {
    /** Original URL being downloaded */
    url: string;
    /** Display name for the asset (filename or derived from URL) */
    name: string;
  } | null;
  /** Bytes downloaded for current asset */
  bytesDownloaded: number;
  /** Total bytes expected for current asset (0 if unknown) */
  bytesTotal: number;
}

/**
 * Callback type for receiving asset sync progress updates.
 * Called during asset processing to provide visibility into download progress.
 */
export type OnAssetProgress = (progress: AssetSyncProgress) => void;
