/**
 * MediaStore interface for storing and retrieving media files.
 */
export interface MediaStore {
  write(path: string, data: Buffer | ReadableStream): Promise<void>;
  read(path: string): Promise<Buffer | null>;
  exists(path: string): Promise<boolean>;
}

/**
 * Supported image formats for optimization.
 */
export type ImageFormat =
  | "avif"
  | "webp"
  | "jpeg"
  | "png"
  | "tiff"
  | "dz"
  | "ppm"
  | "fits"
  | "gif"
  | "svg"
  | "heif"
  | "pdf"
  | "jp2";

/**
 * Supported audio formats.
 */
export type AudioFormat = "mp3" | "aac" | "ogg" | "flac" | "wav" | "opus";

/**
 * Supported video formats.
 */
export type VideoFormat = "mp4" | "webm" | "mov";

/**
 * Options for image optimization.
 * Keys are format names, values are arrays of [width, height?, quality?] tuples.
 * `base` carries transform-level options applied to every variant.
 */
export type OptimizeImageOpts = Partial<
  Record<ImageFormat, (number | [number?, number?, number?])[]>
> & {
  base?: {
    rotate?: number;
    crop?: { left?: number; top?: number; width: number; height: number };
    keepMetadata?: boolean;
    keepExif?: boolean;
    keepIcc?: boolean;
    colorspace?: string;
  };
};

/**
 * Metadata about a generated variant.
 */
export interface VariantResult {
  path: string;
  width?: number;
  height?: number;
  ext: string;
  quality?: number;
  size: number;
  data: Buffer;
}

/** Storage constraints and conversion options for images */
export interface ImageConstraints {
  mediaType: "image";
  format?: ImageFormat;
  ext?: string;
  quality?: number;
  rotate?: number;
  resize?: {
    width?: number;
    height?: number;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  };
  keepMetadata?: boolean;
  keepExif?: boolean;
  keepIcc?: boolean;
  colorspace?: string;
  crop?: { left?: number; top?: number; width: number; height: number };
  /** Whitelist: only convert these extensions */
  include?: string[];
  /** Blacklist: skip these extensions */
  exclude?: string[];
  /** Limit rule to these collection names */
  collections?: string[];
}

/** Storage constraints and conversion options for video */
export interface VideoConstraints {
  mediaType: "video";
  format?: string;
  ext?: string;
  videoCodec?: string;
  videoBitrate?: number | string;
  videoFilters?: string;
  audioCodec?: string;
  audioBitrate?: number | string;
  audioFilters?: string;
  fps?: number;
  size?: string;
  width?: number;
  height?: number;
  aspect?: number | string;
  frames?: number;
  duration?: number | string;
  seek?: number | string;
  inputFormat?: string;
  pad?: string;
  complexFilters?: string;
  args?: string[];
  /** Whitelist: only convert these extensions */
  include?: string[];
  /** Blacklist: skip these extensions */
  exclude?: string[];
  /** Limit rule to these collection names */
  collections?: string[];
}

/** Storage constraints and conversion options for audio */
export interface AudioConstraints {
  mediaType: "audio";
  format?: string;
  ext?: string;
  codec?: string;
  bitrate?: number | string;
  filters?: string;
  complexFilters?: string;
  duration?: number | string;
  seek?: number | string;
  inputFormat?: string;
  args?: string[];
  /** Whitelist: only convert these extensions */
  include?: string[];
  /** Blacklist: skip these extensions */
  exclude?: string[];
  /** Limit rule to these collection names */
  collections?: string[];
}

/** Discriminated union of all media conversion rules */
export type TransformMediaRule = ImageConstraints | VideoConstraints | AudioConstraints;

/**
 * MediaOptimizer interface for optimizing media.
 */
export interface MediaOptimizer {
  optimize(
    path: string,
    input: Buffer | ReadableStream,
    mediaType: "image" | "video" | "audio",
    opts?: OptimizeImageOpts | OptimizeVideoOpts | OptimizeAudioOpts,
  ): Promise<VariantResult[]>;
}

/** Options for video optimization */
export interface OptimizeVideoOpts {
  format?: string;
  ext?: string;
  videoCodec?: string;
  videoBitrate?: number | string;
  videoFilters?: string;
  audioCodec?: string;
  audioBitrate?: number | string;
  audioFilters?: string;
  fps?: number;
  size?: string;
  width?: number;
  height?: number;
  aspect?: number | string;
  frames?: number;
  duration?: number | string;
  seek?: number | string;
  inputFormat?: string;
  pad?: string;
  complexFilters?: string;
  args?: string[];
}

/** Options for audio optimization */
export interface OptimizeAudioOpts {
  format?: string;
  ext?: string;
  codec?: string;
  bitrate?: number | string;
  filters?: string;
  complexFilters?: string;
  duration?: number | string;
  seek?: number | string;
  inputFormat?: string;
  args?: string[];
}

/** A single variant definition for pre-generation */
export interface VariantDef {
  width?: number;
  height?: number;
  format?: string;
  quality?: number;
  /** Video-specific fields */
  videoCodec?: string;
  videoBitrate?: string;
  fps?: number;
  audioCodec?: string;
  audioBitrate?: string;
  /** Audio-specific fields */
  codec?: string;
  bitrate?: string;
}

/** Per-collection predefined variants to generate at sync time */
export type CollectionVariants = Record<string, VariantDef[]>;

/** Options for on-demand conversion */
export interface MediaConvertOpts {
  mediaType?: "image" | "video" | "audio";
  width?: number;
  height?: number;
  fit?: string;
  format?: string;
  quality?: number;
  rotate?: number;
  /** Crop params */
  cropLeft?: number;
  cropTop?: number;
  cropWidth?: number;
  cropHeight?: number;
  /** Video-specific */
  videoCodec?: string;
  videoBitrate?: string;
  fps?: number;
  size?: string;
  ext?: string;
  audioCodec?: string;
  audioBitrate?: string;
  /** Audio-specific */
  codec?: string;
  bitrate?: string;
}

/** Transform function: converts raw media bytes to a new format/size */
export type MediaTransform = (input: Buffer, opts: MediaConvertOpts) => Promise<Buffer>;
