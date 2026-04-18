import { mimeTypes } from "@contfu/core";
import { and, eq } from "drizzle-orm";
import { getFile } from "./getFile";
import { db } from "../../infra/db/db";
import { mediaVariantTable } from "../../infra/db/schema";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { fileStore as defaultFileStore } from "../../infra/media/media-defaults";
import type {
  CollectionName,
  ImageConvertOpts,
  MediaConvertOpts,
  MediaOptimizer,
  MediaVariants,
  MediaVariantsConfig,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VideoConvertOpts,
} from "../../domain/media";
import type { FileStore } from "../../domain/files";

export class FileLoadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FileLoadError";
  }
}

export type LoadFileOptions<CMap = unknown> = {
  mediaOptimizer?: MediaOptimizer;
  fileStore?: FileStore;
  cache?: boolean;
  /** Variant preset configuration. When set, strict mode rejects unknown requests. */
  mediaVariants?: MediaVariants<CMap>;
  /** Collection for variant config lookup (falls back to default config). */
  collection?: CollectionName<CMap>;
  /** Named preset to apply. Overrides raw opts except for mediaType/ext. */
  variant?: string;
};

function resolveVariantConfig<CMap>(
  mediaVariants?: MediaVariants<CMap>,
  collection?: CollectionName<CMap>,
): MediaVariantsConfig | undefined {
  if (!mediaVariants) return undefined;
  const byCollection = mediaVariants.collections as Record<string, MediaVariantsConfig> | undefined;
  if (collection && byCollection?.[collection]) {
    return byCollection[collection];
  }
  return mediaVariants.default;
}

export async function loadFile<CMap = unknown>(
  path: string,
  opts: MediaConvertOpts,
  {
    mediaOptimizer,
    fileStore,
    cache = false,
    mediaVariants,
    collection,
    variant,
  }: LoadFileOptions<CMap> = {},
): Promise<ReadableStream> {
  const resolvedFileStore = fileStore ?? defaultFileStore;
  const parsed = parseFilePath(path);
  const mediaType = resolveMediaType(parsed.ext, opts.mediaType);
  const file = getFile(parsed.id);

  if (!file) {
    throw new FileLoadError("Not found", 404);
  }

  const variantConfig = resolveVariantConfig(mediaVariants, collection);
  let effectiveOpts = opts;
  if (variant) {
    const preset = variantConfig?.presets[variant];
    if (!preset) {
      throw new FileLoadError(`Unknown variant: ${variant}`, 400);
    }
    effectiveOpts = {
      ...preset,
      mediaType: opts.mediaType ?? preset.mediaType,
    } as MediaConvertOpts;
  } else if (variantConfig?.strict) {
    throw new FileLoadError("Variant name required in strict mode", 400);
  }

  if (cache) {
    const cached = readCachedVariant(
      parsed.id,
      parsed.ext,
      optsWithTarget(parsed.ext, mediaType, effectiveOpts),
    );
    if (cached) {
      return bufferToStream(cached);
    }
  }

  const source = await resolvedFileStore.read(`${file.id}.${file.ext}`);
  if (!source) {
    throw new FileLoadError("Not found", 404);
  }

  if (!mediaOptimizer) {
    throw new FileLoadError("Media optimizer is required", 500);
  }

  const variants = await mediaOptimizer.optimize(
    `${file.id}.${file.ext}`,
    source,
    mediaType,
    toOptimizerOpts(parsed.ext, mediaType, effectiveOpts),
  );

  if (variants.length === 0) {
    throw new FileLoadError("No file output produced", 500);
  }

  const data = variants[0].data;

  if (cache) {
    writeCachedVariant(
      parsed.id,
      parsed.ext,
      optsWithTarget(parsed.ext, mediaType, effectiveOpts),
      data,
    );
  }

  return bufferToStream(data);
}

function parseFilePath(path: string): { id: string; ext: string } {
  const trimmed = path.trim().replace(/^\/+/, "");
  const fileName = trimmed.split("/").at(-1) ?? "";
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === fileName.length - 1) {
    throw new FileLoadError("File path must end with <id>.<media-ext>", 400);
  }

  const id = fileName.slice(0, dotIdx);
  const ext = fileName.slice(dotIdx + 1).toLowerCase();

  if (!mimeTypes[ext]) {
    throw new FileLoadError(`Unsupported media extension: ${ext}`, 400);
  }

  return { id, ext };
}

function resolveMediaType(
  ext: string,
  mediaType?: MediaConvertOpts["mediaType"],
): "image" | "video" | "audio" {
  const derived = mediaTypeFromExt(ext);
  if (mediaType && mediaType !== derived) {
    throw new FileLoadError("Media type does not match requested extension", 400);
  }
  return mediaType ?? derived;
}

function mediaTypeFromExt(ext: string): "image" | "video" | "audio" {
  const mime = mimeTypes[ext];
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "image";
}

function toOptimizerOpts(
  ext: string,
  mediaType: "image" | "video" | "audio",
  opts: MediaConvertOpts,
): OptimizeImageOpts | OptimizeVideoOpts | OptimizeAudioOpts {
  if (mediaType === "image") {
    const img = opts as ImageConvertOpts;
    return {
      [ext]: [[img.resize?.width, img.resize?.height, img.quality]],
      base: {
        rotate: img.rotate,
        crop: img.crop,
        keepMetadata: img.keepMetadata,
        keepExif: img.keepExif,
        keepIcc: img.keepIcc,
        colorspace: img.colorspace,
      },
    } satisfies OptimizeImageOpts;
  }

  if (mediaType === "video") {
    const v = opts as VideoConvertOpts;
    return {
      format: ext,
      ext,
      width: v.width,
      height: v.height,
      fps: v.fps,
      videoCodec: v.videoCodec,
      videoBitrate: v.videoBitrate,
      audioCodec: v.audioCodec,
      audioBitrate: v.audioBitrate,
      size: v.size,
    } satisfies OptimizeVideoOpts;
  }

  const a = opts as Extract<MediaConvertOpts, { mediaType?: "audio" }>;
  return {
    format: ext,
    ext,
    codec: a.codec,
    bitrate: a.bitrate,
  } satisfies OptimizeAudioOpts;
}

function optsWithTarget(
  ext: string,
  mediaType: "image" | "video" | "audio",
  opts: MediaConvertOpts,
): MediaConvertOpts {
  return {
    ...opts,
    ext,
    format: ext,
    mediaType,
  } as MediaConvertOpts;
}

function readCachedVariant(fileId: string, ext: string, opts: MediaConvertOpts): Buffer | null {
  const rows = db
    .select({ data: mediaVariantTable.data })
    .from(mediaVariantTable)
    .where(
      and(
        eq(mediaVariantTable.fileId, decodeId(fileId)),
        eq(mediaVariantTable.ext, ext),
        eq(mediaVariantTable.optsHash, hashOpts(opts as Record<string, unknown>)),
      ),
    )
    .all();

  return rows.length > 0 ? rows[0].data : null;
}

function writeCachedVariant(
  fileId: string,
  ext: string,
  opts: MediaConvertOpts,
  data: Buffer,
): void {
  db.insert(mediaVariantTable)
    .values({
      fileId: decodeId(fileId),
      ext,
      optsHash: hashOpts(opts as Record<string, unknown>),
      opts: opts as Record<string, unknown>,
      size: data.byteLength,
      data,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
}

function bufferToStream(data: Buffer): ReadableStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  });
}
