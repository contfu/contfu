import type {
  ImageFormat,
  MediaConvertOpts,
  MediaOptimizer,
  MediaTransform,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VariantResult,
} from "@contfu/client";
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
    const m4kOpts: ImageOptions[] = [];
    const pathTemplates: { width?: number; height?: number; ext: string; quality?: number }[] = [];

    const baseTransform = opts.base;

    for (const [format, entries] of Object.entries(opts)) {
      if (format === "base") continue;
      for (const entry of entries as (number | [number?, number?, number?])[]) {
        const [width, height, quality] = (typeof entry === "number" ? [entry] : entry).map(
          (v) => v ?? undefined,
        );

        const imageOpt: ImageOptions = {
          format: format as ImageFormat,
          ext: format as ImageFormat,
          quality,
          ...baseTransform,
        };
        if (width || height) {
          imageOpt.resize = { width, height, fit: "inside" };
        }
        m4kOpts.push(imageOpt);
        pathTemplates.push({ width, height, ext: format, quality });
      }
    }

    const buf = input instanceof Buffer ? input : await streamToBuffer(input as ReadableStream);
    const iterable = processImage(toAsyncIterable(buf), m4kOpts);
    if (!iterable) return [];

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
    if (opts?.ext) videoOpts.ext = opts.ext;
    if (opts?.videoCodec) videoOpts.videoCodec = opts.videoCodec;
    if (opts?.videoBitrate) videoOpts.videoBitrate = opts.videoBitrate;
    if (opts?.videoFilters) videoOpts.videoFilters = opts.videoFilters;
    if (opts?.width || opts?.height) videoOpts.size = formatSize(opts?.width, opts?.height);
    if (opts?.size) videoOpts.size = opts.size;
    if (opts?.fps) videoOpts.fps = opts.fps;
    if (opts?.audioCodec) videoOpts.audioCodec = opts.audioCodec;
    if (opts?.audioBitrate) videoOpts.audioBitrate = opts.audioBitrate;
    if (opts?.audioFilters) videoOpts.audioFilters = opts.audioFilters;
    if (opts?.aspect != null) videoOpts.aspect = opts.aspect;
    if (opts?.frames != null) videoOpts.frames = opts.frames;
    if (opts?.duration != null) videoOpts.duration = opts.duration;
    if (opts?.seek != null) videoOpts.seek = opts.seek;
    if (opts?.inputFormat) videoOpts.inputFormat = opts.inputFormat;
    if (opts?.pad) videoOpts.pad = opts.pad;
    if (opts?.complexFilters) videoOpts.complexFilters = opts.complexFilters;
    if (opts?.args) videoOpts.args = opts.args;

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
    const ext = opts?.format ?? "mp3";
    const audioOpts: AudioOptions = {};
    if (opts?.format) audioOpts.format = opts.format;
    if (opts?.ext) audioOpts.ext = opts.ext;
    if (opts?.codec) audioOpts.codec = opts.codec;
    if (opts?.bitrate) audioOpts.bitrate = opts.bitrate;
    if (opts?.filters) audioOpts.filters = opts.filters;
    if (opts?.complexFilters) audioOpts.complexFilters = opts.complexFilters;
    if (opts?.duration != null) audioOpts.duration = opts.duration;
    if (opts?.seek != null) audioOpts.seek = opts.seek;
    if (opts?.inputFormat) audioOpts.inputFormat = opts.inputFormat;
    if (opts?.args) audioOpts.args = opts.args;

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
      const imageOpt: ImageOptions = {};
      if (opts.width || opts.height) {
        imageOpt.resize = {
          width: opts.width,
          height: opts.height,
          fit: opts.fit ?? "inside",
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
      const audioOpt: AudioOptions = {};
      if (opts.format) audioOpt.format = opts.format;
      if (opts.ext) audioOpt.ext = opts.ext;
      if (opts.codec) audioOpt.codec = opts.codec;
      if (opts.bitrate) audioOpt.bitrate = opts.bitrate;

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
