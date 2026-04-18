import type { RemoteImageOptions } from "@m4k/common";

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
 * Resolves to the known collection names of a CMap, or to `string` when no
 * CMap has been provided by the user.
 */
export type CollectionName<CMap> = unknown extends CMap ? string : keyof CMap & string;

/**
 * Options for image optimization (multi-variant form fed to the optimizer).
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

/** Sync-time conversion rule for images */
export interface TransformImageRule<CMap = unknown> {
  mediaType: "image";
  format?: ImageFormat;
  ext?: string;
  quality?: number;
  rotate?: number;
  resize?: {
    width?: number;
    height?: number;
    fit?: (RemoteImageOptions["resize"] & {})["fit"];
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
  collections?: CollectionName<CMap>[];
}

/** Sync-time conversion rule for video */
export interface TransformVideoRule<CMap = unknown> {
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
  include?: string[];
  exclude?: string[];
  collections?: CollectionName<CMap>[];
}

/** Sync-time conversion rule for audio */
export interface TransformAudioRule<CMap = unknown> {
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
  include?: string[];
  exclude?: string[];
  collections?: CollectionName<CMap>[];
}

/** Discriminated union of all media conversion rules */
export type TransformMediaRule<CMap = unknown> =
  | TransformImageRule<CMap>
  | TransformVideoRule<CMap>
  | TransformAudioRule<CMap>;

/** Fields used for filtering rules; not part of the optimizer's options */
type RuleFilterFields = "include" | "exclude" | "collections";
type OptimizerOmitFields = RuleFilterFields | "mediaType";

/** On-demand image conversion options (derived from the image rule) */
export type ImageConvertOpts = Omit<TransformImageRule, OptimizerOmitFields> & {
  mediaType?: "image";
};

/** On-demand video conversion options (derived from the video rule) */
export type VideoConvertOpts = Omit<TransformVideoRule, OptimizerOmitFields> & {
  mediaType?: "video";
};

/** On-demand audio conversion options (derived from the audio rule) */
export type AudioConvertOpts = Omit<TransformAudioRule, OptimizerOmitFields> & {
  mediaType?: "audio";
};

/** On-demand conversion options for any media type */
export type MediaConvertOpts = ImageConvertOpts | VideoConvertOpts | AudioConvertOpts;

/** Video optimizer options (single-variant optimizer input) */
export type OptimizeVideoOpts = Omit<TransformVideoRule, OptimizerOmitFields>;

/** Audio optimizer options (single-variant optimizer input) */
export type OptimizeAudioOpts = Omit<TransformAudioRule, OptimizerOmitFields>;

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

/** Transform function: converts raw media bytes to a new format/size */
export type MediaTransform = (input: Buffer, opts: MediaConvertOpts) => Promise<Buffer>;

/** Named variant preset config for a collection (or global default) */
export interface MediaVariantsConfig {
  /** Named variant presets. On-demand requests reference these via ?variant=name. */
  presets: Record<string, MediaConvertOpts>;
  /** Names of presets to pre-generate at sync time. Empty/omitted = on-demand only. */
  pregenerate?: string[];
  /** When true, on-demand requests MUST specify a valid preset name. Default: false. */
  strict?: boolean;
}

/** Media variants configuration: global default plus per-collection overrides */
export interface MediaVariants<CMap = unknown> {
  /** Default config applied to all collections without an explicit override */
  default?: MediaVariantsConfig;
  /** Per-collection overrides (replace default, not merged) */
  collections?: Partial<Record<CollectionName<CMap>, MediaVariantsConfig>>;
}
