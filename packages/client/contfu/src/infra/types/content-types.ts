import type { ImageBlock, Block } from "@contfu/core";
import type { SourceType } from "@contfu/core";

export type ItemLinks = Record<string, string[]> & { content: string[] };

export interface ItemData {
  id: string;
  sourceType?: SourceType | null;
  ref: string | null;
  collection: string;
  props: Record<string, unknown>;
  changedAt: number;
  content?: Block[];
  links: ItemLinks;
}

export interface Asset<T extends { format?: string } = { format: string }> {
  format: T extends { format: infer F } ? F : string;
}

export interface AssetData<A extends Asset = Asset> {
  id: string;
  itemId: string;
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
