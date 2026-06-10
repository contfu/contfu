import type { ImageBlock, Block } from "@contfu/core";

/** A resolved content link: partial item (internal) or URL string (external) */
export type ResolvedLink = (Partial<ItemData> & { id: number }) | string | null;

/** Content links on item.links: array of resolved links from content anchors */
export type ContentLinks = ResolvedLink[];

export interface ItemData {
  id: number;
  collection: string;
  props: Record<string, unknown>;
  changedAt: number;
  content?: Block[];
  links: ContentLinks;
}

export type FileStatusData = "pending" | "ready" | "failed";

export type BaseFileData = {
  id: string;
  status: FileStatusData;
  ext: string;
  size: number;
  data?: Buffer;
  createdAt: number;
  attempts?: number;
  error?: string;
};

export type ImageFileData = BaseFileData & {
  mediaType: "image";
  width?: number;
  height?: number;
};

export type VideoFileData = BaseFileData & {
  mediaType: "video";
  width?: number;
  height?: number;
  duration?: number;
};

export type AudioFileData = BaseFileData & {
  mediaType: "audio";
  duration?: number;
};

export type UnknownFileData = BaseFileData & {
  mediaType: string;
};

export type FileData = ImageFileData | VideoFileData | AudioFileData | UnknownFileData;

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
