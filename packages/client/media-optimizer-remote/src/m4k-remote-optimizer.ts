import type {
  ImageFormat,
  MediaConvertOpts,
  MediaOptimizer,
  MediaTransform,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VariantResult,
} from "contfu";
import { ProcessedFile, processAudio, processImage, processVideo } from "@m4k/client";
import type { ImageOptions, VideoOptions, AudioOptions } from "@m4k/common";
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

export class M4kRemoteOptimizer implements MediaOptimizer {
  constructor(private readonly host: string) {}

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
    const m4kOpts: ImageOptions[] = [];
    const pathTemplates: { width?: number; height?: number; ext: string; quality?: number }[] = [];

    for (const [format, entries] of Object.entries(opts)) {
      for (const entry of entries) {
        const [width, height, quality] = (typeof entry === "number" ? [entry] : entry).map(
          (v) => v ?? undefined,
        );

        const imageOpt: ImageOptions = {
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

    const buf = input instanceof Buffer ? input : await streamToBuffer(input);
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
    const ext = opts?.format ?? "mp4";
    const videoOpts: VideoOptions = {};
    if (opts?.format) videoOpts.format = opts.format;
    if (opts?.videoCodec) videoOpts.videoCodec = opts.videoCodec;
    if (opts?.videoBitrate) videoOpts.videoBitrate = opts.videoBitrate;
    if (opts?.width || opts?.height) videoOpts.size = formatSize(opts?.width, opts?.height);
    if (opts?.fps) videoOpts.fps = opts.fps;
    if (opts?.audioCodec) videoOpts.audioCodec = opts.audioCodec;
    if (opts?.audioBitrate) videoOpts.audioBitrate = opts.audioBitrate;

    const buf = input instanceof Buffer ? input : await streamToBuffer(input);
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
    const ext = opts?.format ?? "mp3";
    const audioOpts: AudioOptions = {};
    if (opts?.format) audioOpts.format = opts.format;
    if (opts?.codec) audioOpts.codec = opts.codec;
    if (opts?.bitrate) audioOpts.bitrate = opts.bitrate;

    const buf = input instanceof Buffer ? input : await streamToBuffer(input);
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
export function createTransform(host: string): MediaTransform {
  return async (input: Buffer, opts: MediaConvertOpts): Promise<Buffer> => {
    const mediaType = opts.mediaType ?? "image";

    if (mediaType === "image") {
      const imageOpt: ImageOptions = {};
      if (opts.width || opts.height) {
        imageOpt.resize = {
          width: opts.width,
          height: opts.height,
          fit:
            (opts.fit as ImageOptions["resize"] extends { fit?: infer F } ? F : string) ?? "inside",
        };
      }
      if (opts.format) {
        imageOpt.format = opts.format as ImageOptions["format"];
        imageOpt.ext = opts.format as ImageOptions["format"];
      }
      if (opts.quality) imageOpt.quality = opts.quality;
      if (opts.rotate != null) imageOpt.rotate = opts.rotate;
      if (opts.cropWidth) {
        imageOpt.crop = {
          left: opts.cropLeft,
          top: opts.cropTop,
          width: opts.cropWidth,
          height: opts.cropHeight!,
        };
      }

      const iterable = processImage(host, toAsyncIterable(input), imageOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No image output produced");
    }

    if (mediaType === "video") {
      const videoOpt: VideoOptions = {};
      if (opts.format) videoOpt.format = opts.format;
      if (opts.ext) videoOpt.ext = opts.ext;
      if (opts.videoCodec) videoOpt.videoCodec = opts.videoCodec;
      if (opts.videoBitrate) videoOpt.videoBitrate = opts.videoBitrate;
      if (opts.width || opts.height) videoOpt.size = formatSize(opts.width, opts.height);
      if (opts.size) videoOpt.size = opts.size;
      if (opts.fps) videoOpt.fps = opts.fps;
      if (opts.audioCodec) videoOpt.audioCodec = opts.audioCodec;
      if (opts.audioBitrate) videoOpt.audioBitrate = opts.audioBitrate;

      const iterable = processVideo(host, toAsyncIterable(input), videoOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No video output produced");
    }

    if (mediaType === "audio") {
      const audioOpt: AudioOptions = {};
      if (opts.format) audioOpt.format = opts.format;
      if (opts.ext) audioOpt.ext = opts.ext;
      if (opts.codec) audioOpt.codec = opts.codec;
      if (opts.bitrate) audioOpt.bitrate = opts.bitrate;

      const iterable = processAudio(host, toAsyncIterable(input), audioOpt);
      for await (const item of iterable) {
        if (item instanceof ProcessedFile) {
          return collectProcessedFile(item);
        }
      }
      throw new Error("No audio output produced");
    }

    throw new Error(`Unsupported media type: ${mediaType}`);
  };
}
