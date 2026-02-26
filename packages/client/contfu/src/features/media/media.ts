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
export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

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
 */
export type OptimizeImageOpts = Partial<
  Record<ImageFormat, (number | [number?, number?, number?])[]>
>;

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

/** Storage constraints for images */
export interface ImageConstraints {
  format?: ImageFormat;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/** Storage constraints for video */
export interface VideoConstraints {
  format?: VideoFormat;
  videoCodec?: string;
  videoBitrate?: string;
  width?: number;
  height?: number;
  fps?: number;
  audioCodec?: string;
  audioBitrate?: string;
}

/** Storage constraints for audio */
export interface AudioConstraints {
  format?: AudioFormat;
  codec?: string;
  bitrate?: string;
}

/** Storage constraints keyed by media type */
export type MediaConstraints = {
  image?: ImageConstraints;
  video?: VideoConstraints;
  audio?: AudioConstraints;
  document?: never;
};

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
  format?: VideoFormat;
  videoCodec?: string;
  videoBitrate?: string;
  width?: number;
  height?: number;
  fps?: number;
  audioCodec?: string;
  audioBitrate?: string;
}

/** Options for audio optimization */
export interface OptimizeAudioOpts {
  format?: AudioFormat;
  codec?: string;
  bitrate?: string;
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
