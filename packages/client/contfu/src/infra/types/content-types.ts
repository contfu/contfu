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

export interface AssetData {
  id: string;
  originalUrl: string;
  mediaType: string;
  ext: string;
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
