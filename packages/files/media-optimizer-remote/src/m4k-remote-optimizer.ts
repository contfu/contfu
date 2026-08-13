import type {
  ImageFormat,
  MediaConvertOpts,
  MediaOptimizer,
  MediaTransform,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VariantResult,
} from "@contfu/contfu";
import { ProcessedFile, processAudio, processImage, processVideo } from "@m4k/client";
import type {
  ImageOptions,
  RemoteAudioOptions,
  RemoteImageOptions,
  RemoteVideoOptions,
} from "@m4k/common";
import { basename, extname } from "node:path";

/**
 * Collect all chunks from a ProcessedFile's async stream into a Buffer.
 */
async function collectProcessedFile(file: ProcessedFile): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  if (file.stream) {
    for await (const chunk of file.stream) {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

/** Convert a Buffer to an AsyncIterable<Uint8Array> for m4k input */
// eslint-disable-next-line typescript/require-await -- async generator required by AsyncIterable return type
async function* toAsyncIterable(buf: Buffer): AsyncIterable<Uint8Array> {
  yield new Uint8Array(buf);
}

/** Convert a ReadableStream to a Buffer */
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Format width/height as ffmpeg size string */
function formatSize(width?: number, height?: number): string {
  if (width && height) return `${width}x${height}`;
  if (width) return `${width}x-1`;
  if (height) return `-1x${height}`;
  return "";
}

export type M4kRemoteOptimizerOptions = string | { url: string };

function resolveM4kHost(options: M4kRemoteOptimizerOptions): string {
  return typeof options === "string" ? options : options.url;
}

function toRemoteImageOptions(
  img: Extract<MediaConvertOpts, { mediaType?: "image" }>,
): RemoteImageOptions {
  const imageOpt: RemoteImageOptions = {};
  if (img.resize?.width || img.resize?.height) {
    imageOpt.resize = {
      width: img.resize.width,
      height: img.resize.height,
      fit: img.resize.fit,
    };
  }
  if (img.format) imageOpt.format = img.format as ImageOptions["format"];
  if (img.ext ?? img.format) imageOpt.ext = (img.ext ?? img.format) as ImageOptions["ext"];
  if (img.quality) imageOpt.quality = img.quality;
  if (img.rotate != null) imageOpt.rotate = img.rotate;
  if (img.crop) imageOpt.crop = img.crop;
  if (img.keepMetadata != null) imageOpt.keepMetadata = img.keepMetadata;
  if (img.keepExif != null) imageOpt.keepExif = img.keepExif;
  if (img.keepIcc != null) imageOpt.keepIcc = img.keepIcc;
  if (img.colorspace) imageOpt.colorspace = img.colorspace;
  return imageOpt;
}

/**
 * Copy the option keys that are set, so an unset option never lands in the
 * payload. `truthyKeys` drop empty strings and zeroes as "not configured";
 * `nullableKeys` keep those values and only drop null/undefined.
 */
function copyDefinedOptions<S extends object, T extends object>(
  source: S | undefined,
  target: T,
  truthyKeys: readonly (keyof S & keyof T)[],
  nullableKeys: readonly (keyof S & keyof T)[],
): T {
  if (!source) return target;
  for (const key of truthyKeys) {
    if (source[key]) target[key] = source[key] as never;
  }
  for (const key of nullableKeys) {
    if (source[key] != null) target[key] = source[key] as never;
  }
  return target;
}

/** Options copied when truthy; empty strings and zeroes mean "not configured". */
const VIDEO_TRUTHY_KEYS = [
  "format",
  "ext",
  "videoCodec",
  "videoBitrate",
  "videoFilters",
  "size",
  "fps",
  "audioCodec",
  "audioBitrate",
  "audioFilters",
  "inputFormat",
  "pad",
  "complexFilters",
  "args",
] as const;

/** Options where 0 is meaningful, so only null/undefined are dropped. */
const VIDEO_NULLABLE_KEYS = ["aspect", "frames", "duration", "seek"] as const;

function toRemoteVideoOptions(
  video: OptimizeVideoOpts | Extract<MediaConvertOpts, { mediaType?: "video" }> | undefined,
): RemoteVideoOptions {
  const videoOpt: RemoteVideoOptions = {};
  // `size` derived from width/height first, so an explicit `size` still wins.
  if (video?.width || video?.height) videoOpt.size = formatSize(video?.width, video?.height);
  return copyDefinedOptions(video, videoOpt, VIDEO_TRUTHY_KEYS, VIDEO_NULLABLE_KEYS);
}

function toRemoteAudioOptions(
  audio: OptimizeAudioOpts | Extract<MediaConvertOpts, { mediaType?: "audio" }> | undefined,
): RemoteAudioOptions {
  const audioOpt: RemoteAudioOptions = {};
  if (audio?.format) audioOpt.format = audio.format;
  if (audio?.ext) audioOpt.ext = audio.ext;
  if (audio?.codec) audioOpt.codec = audio.codec;
  if (audio?.bitrate) audioOpt.bitrate = audio.bitrate;
  if (audio?.filters) audioOpt.filters = audio.filters;
  if (audio?.complexFilters) audioOpt.complexFilters = audio.complexFilters;
  if (audio?.duration != null) audioOpt.duration = audio.duration;
  if (audio?.seek != null) audioOpt.seek = audio.seek;
  if (audio?.inputFormat) audioOpt.inputFormat = audio.inputFormat;
  if (audio?.args) audioOpt.args = audio.args;
  return audioOpt;
}

export class M4kRemoteOptimizer implements MediaOptimizer {
  private readonly host: string;

  constructor(options: M4kRemoteOptimizerOptions) {
    this.host = resolveM4kHost(options);
  }

  async optimize(
    path: string,
    input: Buffer | ReadableStream,
    mediaType: "image" | "video" | "audio",
    opts?: OptimizeImageOpts | OptimizeVideoOpts | OptimizeAudioOpts,
  ): Promise<VariantResult[]> {
    const base = basename(path, extname(path));

    if (mediaType === "image") {
      return this.processImageVariants(base, input, opts as OptimizeImageOpts);
    }
    if (mediaType === "video") {
      return this.processVideoVariant(base, input, opts as OptimizeVideoOpts);
    }
    if (mediaType === "audio") {
      return this.processAudioVariant(base, input, opts as OptimizeAudioOpts);
    }

    return [];
  }

  private async processImageVariants(
    base: string,
    input: Buffer | ReadableStream,
    opts: OptimizeImageOpts = { avif: [[]] },
  ): Promise<VariantResult[]> {
    const m4kOpts: RemoteImageOptions[] = [];
    const pathTemplates: { width?: number; height?: number; ext: string; quality?: number }[] = [];

    for (const [format, entries] of Object.entries(opts)) {
      if (format === "base" || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        const [width, height, quality] = (typeof entry === "number" ? [entry] : entry).map(
          (v: number | undefined) => v ?? undefined,
        );

        const imageOpt: RemoteImageOptions = {
          ...opts.base,
          format: format as ImageFormat,
          ext: format as ImageFormat,
          quality,
        };
        if (width || height) {
          imageOpt.resize = { width, height, fit: "inside" };
        }
        m4kOpts.push(imageOpt);
        pathTemplates.push({ width, height, ext: format, quality });
      }
    }

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processImage(this.host, toAsyncIterable(buf), m4kOpts);

    const results: VariantResult[] = [];
    let templateIdx = 0;

    for await (const item of iterable) {
      if (item instanceof ProcessedFile) {
        const tmpl = pathTemplates[templateIdx];
        const w = tmpl.width ? `w${tmpl.width}` : "";
        const h = tmpl.height ? `h${tmpl.height}` : "";
        const path = `${base}${w || h ? "/" : ""}${w}${h}.${tmpl.ext}`;

        const buffer = await collectProcessedFile(item);
        results.push({
          path,
          width: tmpl.width,
          height: tmpl.height,
          ext: tmpl.ext,
          quality: tmpl.quality,
          size: buffer.byteLength,
          data: buffer,
        });
        templateIdx++;
      }
    }

    return results;
  }

  private async processVideoVariant(
    base: string,
    input: Buffer | ReadableStream,
    opts?: OptimizeVideoOpts,
  ): Promise<VariantResult[]> {
    const ext = opts?.ext ?? opts?.format ?? "mp4";
    const videoOpts = toRemoteVideoOptions(opts);

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processVideo(this.host, toAsyncIterable(buf), videoOpts);

    const results: VariantResult[] = [];
    for await (const item of iterable) {
      if (item instanceof ProcessedFile) {
        const path = `${base}.${ext}`;
        const buffer = await collectProcessedFile(item);
        results.push({
          path,
          width: opts?.width,
          height: opts?.height,
          ext,
          size: buffer.byteLength,
          data: buffer,
        });
      }
    }
    return results;
  }

  private async processAudioVariant(
    base: string,
    input: Buffer | ReadableStream,
    opts?: OptimizeAudioOpts,
  ): Promise<VariantResult[]> {
    const ext = opts?.ext ?? opts?.format ?? "mp3";
    const audioOpts = toRemoteAudioOptions(opts);

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processAudio(this.host, toAsyncIterable(buf), audioOpts);

    const results: VariantResult[] = [];
    for await (const item of iterable) {
      if (item instanceof ProcessedFile) {
        const path = `${base}.${ext}`;
        const buffer = await collectProcessedFile(item);
        results.push({
          path,
          ext,
          size: buffer.byteLength,
          data: buffer,
        });
      }
    }
    return results;
  }
}

/**
 * Create a MediaTransform function backed by @m4k/client.
 * Use with convertMedia() for on-demand remote media conversion.
 */
export function createTransform(options: M4kRemoteOptimizerOptions): MediaTransform {
  const host = resolveM4kHost(options);

  return async (input: Buffer, opts: MediaConvertOpts): Promise<Buffer> => {
    const mediaType = opts.mediaType ?? "image";

    if (mediaType === "image") {
      const img = opts as Extract<MediaConvertOpts, { mediaType?: "image" }>;
      const imageOpt = toRemoteImageOptions(img);

      const iterable = processImage(host, toAsyncIterable(input), imageOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No image output produced");
    }

    if (mediaType === "video") {
      const v = opts as Extract<MediaConvertOpts, { mediaType?: "video" }>;
      const videoOpt = toRemoteVideoOptions(v);

      const iterable = processVideo(host, toAsyncIterable(input), videoOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No video output produced");
    }

    if (mediaType === "audio") {
      const a = opts as Extract<MediaConvertOpts, { mediaType?: "audio" }>;
      const audioOpt = toRemoteAudioOptions(a);

      const iterable = processAudio(host, toAsyncIterable(input), audioOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No audio output produced");
    }

    throw new Error(`Unsupported media type: ${String(mediaType)}`);
  };
}
