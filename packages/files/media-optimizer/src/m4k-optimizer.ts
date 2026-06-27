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
import {
  ProcessedFile,
  processAudio,
  processImage,
  processVideo,
  type AudioOptions,
  type ImageOptions,
  type VideoOptions,
} from "m4k";
import { basename, extname } from "node:path";

type BunImageOutput = {
  bytes?: () => Promise<Uint8Array> | Uint8Array;
  buffer?: () => Promise<ArrayBuffer> | ArrayBuffer;
};

type BunImageInstance = {
  resize?: (width?: number, height?: number) => BunImageInstance;
  jpeg?: (opts?: { quality?: number }) => BunImageOutput;
  png?: (opts?: { quality?: number }) => BunImageOutput;
  webp?: (opts?: { quality?: number }) => BunImageOutput;
};

type BunImageFactory = new (input: Buffer | Uint8Array | ArrayBuffer) => BunImageInstance;

const bunImageInputFormats = new Set(["jpeg", "png", "webp", "gif", "bmp"]);
const bunImageOutputFormats = new Set(["jpeg", "png", "webp"]);

function getBunImage(): BunImageFactory | undefined {
  return (globalThis as unknown as { Bun?: { Image?: BunImageFactory } }).Bun?.Image;
}

function detectBunImageInputFormat(input: Buffer): string | undefined {
  if (input.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  const gifHeader = input.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "gif";
  if (input.subarray(0, 2).toString("ascii") === "BM") return "bmp";
  if (
    input.subarray(0, 4).toString("ascii") === "RIFF" &&
    input.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return undefined;
}

function canUseBunImage(
  input: Buffer,
  opts: {
    format?: string;
    width?: number;
    height?: number;
    resizeFit?: string;
    rotate?: number;
    crop?: unknown;
    keepMetadata?: boolean;
    keepExif?: boolean;
    keepIcc?: boolean;
    colorspace?: string;
  },
): opts is typeof opts & { format: "jpeg" | "png" | "webp" } {
  return (
    !!getBunImage() &&
    !!detectBunImageInputFormat(input) &&
    bunImageInputFormats.has(detectBunImageInputFormat(input)!) &&
    !!opts.format &&
    bunImageOutputFormats.has(opts.format) &&
    !opts.rotate &&
    !opts.crop &&
    !opts.keepMetadata &&
    !opts.keepExif &&
    !opts.keepIcc &&
    !opts.colorspace &&
    (!opts.height || !!opts.width) &&
    (!opts.resizeFit || opts.resizeFit === "inside")
  );
}

async function processWithBunImage(
  input: Buffer,
  opts: { format: "jpeg" | "png" | "webp"; width?: number; height?: number; quality?: number },
): Promise<Buffer | undefined> {
  const Image = getBunImage();
  if (!Image) return undefined;

  try {
    let image = new Image(input);
    if (opts.width || opts.height) {
      if (typeof image.resize !== "function") return undefined;
      image = image.resize(opts.width, opts.height);
    }
    const encode = image[opts.format];
    if (typeof encode !== "function") return undefined;
    const output = encode.call(image, { quality: opts.quality });
    if (typeof output.bytes === "function") return Buffer.from(await output.bytes());
    if (typeof output.buffer === "function") return Buffer.from(await output.buffer());
  } catch {
    return undefined;
  }
}

/**
 * Collect all chunks from a ProcessedFile's async stream into a Buffer.
 */
export async function collectProcessedFile(file: ProcessedFile): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  if (file.stream) {
    for await (const chunk of file.stream) {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

export function toM4kImageOptions(
  img: Extract<MediaConvertOpts, { mediaType?: "image" }>,
): ImageOptions {
  const imageOpt: ImageOptions = {};
  if (img.resize?.width || img.resize?.height) {
    imageOpt.resize = {
      width: img.resize.width,
      height: img.resize.height,
      fit: img.resize.fit ?? "inside",
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

export function toM4kVideoOptions(
  video: OptimizeVideoOpts | Extract<MediaConvertOpts, { mediaType?: "video" }> | undefined,
): VideoOptions {
  const videoOpt: VideoOptions = {};
  if (video?.format) videoOpt.format = video.format;
  if (video?.ext) videoOpt.ext = video.ext;
  if (video?.videoCodec) videoOpt.videoCodec = video.videoCodec;
  if (video?.videoBitrate) videoOpt.videoBitrate = video.videoBitrate;
  if (video?.videoFilters) videoOpt.videoFilters = video.videoFilters;
  if (video?.width || video?.height) videoOpt.size = formatSize(video?.width, video?.height);
  if (video?.size) videoOpt.size = video.size;
  if (video?.fps) videoOpt.fps = video.fps;
  if (video?.audioCodec) videoOpt.audioCodec = video.audioCodec;
  if (video?.audioBitrate) videoOpt.audioBitrate = video.audioBitrate;
  if (video?.audioFilters) videoOpt.audioFilters = video.audioFilters;
  if (video?.aspect != null) videoOpt.aspect = video.aspect;
  if (video?.frames != null) videoOpt.frames = video.frames;
  if (video?.duration != null) videoOpt.duration = video.duration;
  if (video?.seek != null) videoOpt.seek = video.seek;
  if (video?.inputFormat) videoOpt.inputFormat = video.inputFormat;
  if (video?.pad) videoOpt.pad = video.pad;
  if (video?.complexFilters) videoOpt.complexFilters = video.complexFilters;
  if (video?.args) videoOpt.args = video.args;
  return videoOpt;
}

export function toM4kAudioOptions(
  audio: OptimizeAudioOpts | Extract<MediaConvertOpts, { mediaType?: "audio" }> | undefined,
): AudioOptions {
  const audioOpt: AudioOptions = {};
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

export class M4kOptimizer implements MediaOptimizer {
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
    const baseTransform = opts.base;
    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const results: VariantResult[] = [];

    for (const [format, entries] of Object.entries(opts)) {
      if (format === "base") continue;
      for (const entry of entries as (number | [number?, number?, number?])[]) {
        const [width, height, quality] = (typeof entry === "number" ? [entry] : entry).map(
          (v) => v ?? undefined,
        );
        const w = width ? `w${width}` : "";
        const h = height ? `h${height}` : "";
        const path = `${base}${w || h ? "/" : ""}${w}${h}.${format}`;

        let buffer: Buffer | undefined;
        if (canUseBunImage(buf, { format, width, height, resizeFit: "inside", ...baseTransform })) {
          buffer = await processWithBunImage(buf, {
            format: format as "jpeg" | "png" | "webp",
            width,
            height,
            quality,
          });
        }

        if (!buffer) {
          const imageOpt: ImageOptions = {
            format: format as ImageFormat,
            ext: format as ImageFormat,
            quality,
            ...baseTransform,
          };
          if (width || height) {
            imageOpt.resize = { width, height, fit: "inside" };
          }
          const iterable = processImage(toAsyncIterable(buf), imageOpt);
          if (!iterable) continue;
          for await (const item of iterable) {
            if (item instanceof ProcessedFile) {
              buffer = await collectProcessedFile(item);
              break;
            }
          }
        }

        if (buffer) {
          results.push({
            path,
            width,
            height,
            ext: format,
            quality,
            size: buffer.byteLength,
            data: buffer,
          });
        }
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
    const videoOpts = toM4kVideoOptions(opts);

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processVideo(toAsyncIterable(buf), videoOpts);
    if (!iterable) return [];

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
    const audioOpts = toM4kAudioOptions(opts);

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processAudio(toAsyncIterable(buf), audioOpts);
    if (!iterable) return [];

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
 * Create a MediaTransform function backed by m4k.
 * Use with convertMedia() for on-demand media conversion.
 */
export function createTransform(): MediaTransform {
  return async (input: Buffer, opts: MediaConvertOpts): Promise<Buffer> => {
    const mediaType = opts.mediaType ?? "image";

    if (mediaType === "image") {
      const img = opts as Extract<MediaConvertOpts, { mediaType?: "image" }>;
      const imageOpt = toM4kImageOptions(img);

      if (
        canUseBunImage(input, {
          format: img.format,
          width: img.resize?.width,
          height: img.resize?.height,
          resizeFit: img.resize?.fit,
          rotate: img.rotate,
          crop: img.crop,
          keepMetadata: img.keepMetadata,
          keepExif: img.keepExif,
          keepIcc: img.keepIcc,
          colorspace: img.colorspace,
        })
      ) {
        const buffer = await processWithBunImage(input, {
          format: img.format as "jpeg" | "png" | "webp",
          width: img.resize?.width,
          height: img.resize?.height,
          quality: img.quality,
        });
        if (buffer) return buffer;
      }

      const iterable = processImage(toAsyncIterable(input), imageOpt);
      if (!iterable) throw new Error("Image processing queue full");
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No image output produced");
    }

    if (mediaType === "video") {
      const v = opts as Extract<MediaConvertOpts, { mediaType?: "video" }>;
      const videoOpt = toM4kVideoOptions(v);

      const iterable = processVideo(toAsyncIterable(input), videoOpt);
      if (!iterable) throw new Error("Video processing queue full");
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No video output produced");
    }

    if (mediaType === "audio") {
      const a = opts as Extract<MediaConvertOpts, { mediaType?: "audio" }>;
      const audioOpt = toM4kAudioOptions(a);

      const iterable = processAudio(toAsyncIterable(input), audioOpt);
      if (!iterable) throw new Error("Audio processing queue full");
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

/** Convert a Buffer to an AsyncIterable<Uint8Array> for m4k input */
// eslint-disable-next-line typescript/require-await -- async generator required by AsyncIterable return type
export async function* toAsyncIterable(buf: Buffer): AsyncIterable<Uint8Array> {
  yield new Uint8Array(buf);
}

/** Convert a ReadableStream to a Buffer */
export async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Format width/height as ffmpeg size string (e.g. "1920x1080") */
export function formatSize(width?: number, height?: number): string {
  if (width && height) return `${width}x${height}`;
  if (width) return `${width}x-1`;
  if (height) return `-1x${height}`;
  return "";
}
