import type { ImageBlock, Block } from "@contfu/core";
import type { ConnectionType } from "@contfu/core";

/** A resolved content link: partial item (internal) or URL string (external) */
export type ResolvedLink = (Partial<ItemData> & { id: string }) | string | null;

/** Content links on item.links: array of resolved links from content anchors */
export type ContentLinks = ResolvedLink[];

export interface ItemData {
  id: string;
  connectionType?: ConnectionType | null;
  ref: string | null;
  collection: string;
  props: Record<string, unknown>;
  changedAt: number;
  content?: Block[];
  links: ContentLinks;
}

export interface FileData {
  id: string;
  originalUrl: string;
  mediaType: string;
  ext: string;
  size: number;
  data?: Buffer;
  createdAt: number;
}

export interface FileReference {
  block: ImageBlock;
  ref: string;
}

export interface FileSyncProgress {
  total: number;
  completed: number;
  current: {
    url: string;
    name: string;
  } | null;
  bytesDownloaded: number;
  bytesTotal: number;
}

export type OnFileProgress = (progress: FileSyncProgress) => void;
