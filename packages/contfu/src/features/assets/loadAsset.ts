import { mimeTypes } from "@contfu/core";
import { and, eq } from "drizzle-orm";
import { getAsset } from "./getAsset";
import { db } from "../../infra/db/db";
import { mediaVariantTable } from "../../infra/db/schema";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { assetStore as defaultAssetStore } from "../../infra/media/media-defaults";
import type {
  MediaConvertOpts,
  MediaOptimizer,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
} from "../../domain/media";
import type { AssetStore } from "../../domain/assets";

export class AssetLoadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AssetLoadError";
  }
}

export type LoadAssetOptions = {
  mediaOptimizer?: MediaOptimizer;
  assetStore?: AssetStore;
  cache?: boolean;
};

export async function loadAsset(
  path: string,
  opts: MediaConvertOpts,
  { mediaOptimizer, assetStore, cache = false }: LoadAssetOptions = {},
): Promise<ReadableStream> {
  const resolvedAssetStore = assetStore ?? defaultAssetStore;
  const parsed = parseAssetPath(path);
  const mediaType = resolveMediaType(parsed.ext, opts.mediaType);
  const asset = getAsset(parsed.id);

  if (!asset) {
    throw new AssetLoadError("Not found", 404);
  }

  if (cache) {
    const cached = readCachedVariant(
      parsed.id,
      parsed.ext,
      optsWithTarget(parsed.ext, mediaType, opts),
    );
    if (cached) {
      return bufferToStream(cached);
    }
  }

  const source = await resolvedAssetStore.read(`${asset.id}.${asset.ext}`);
  if (!source) {
    throw new AssetLoadError("Not found", 404);
  }

  if (!mediaOptimizer) {
    throw new AssetLoadError("Media optimizer is required", 500);
  }

  const variant = await mediaOptimizer.optimize(
    `${asset.id}.${asset.ext}`,
    source,
    mediaType,
    toOptimizerOpts(parsed.ext, mediaType, opts),
  );

  if (variant.length === 0) {
    throw new AssetLoadError("No asset output produced", 500);
  }

  const data = variant[0].data;

  if (cache) {
    writeCachedVariant(parsed.id, parsed.ext, optsWithTarget(parsed.ext, mediaType, opts), data);
  }

  return bufferToStream(data);
}

function parseAssetPath(path: string): { id: string; ext: string } {
  const trimmed = path.trim().replace(/^\/+/, "");
  const fileName = trimmed.split("/").at(-1) ?? "";
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === fileName.length - 1) {
    throw new AssetLoadError("Asset path must end with <id>.<media-ext>", 400);
  }

  const id = fileName.slice(0, dotIdx);
  const ext = fileName.slice(dotIdx + 1).toLowerCase();

  if (!mimeTypes[ext]) {
    throw new AssetLoadError(`Unsupported media extension: ${ext}`, 400);
  }

  return { id, ext };
}

function resolveMediaType(
  ext: string,
  mediaType?: MediaConvertOpts["mediaType"],
): "image" | "video" | "audio" {
  const derived = mediaTypeFromExt(ext);
  if (mediaType && mediaType !== derived) {
    throw new AssetLoadError("Media type does not match requested extension", 400);
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
    return {
      [ext]: [[opts.width, opts.height, opts.quality]],
      base: {
        rotate: opts.rotate,
        crop: opts.cropWidth
          ? {
              left: opts.cropLeft,
              top: opts.cropTop,
              width: opts.cropWidth,
              height: opts.cropHeight!,
            }
          : undefined,
      },
    } satisfies OptimizeImageOpts;
  }

  if (mediaType === "video") {
    return {
      format: ext,
      ext,
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      videoCodec: opts.videoCodec,
      videoBitrate: opts.videoBitrate,
      audioCodec: opts.audioCodec,
      audioBitrate: opts.audioBitrate,
      size: opts.size,
    } satisfies OptimizeVideoOpts;
  }

  return {
    format: ext,
    ext,
    codec: opts.codec,
    bitrate: opts.bitrate,
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
  };
}

function readCachedVariant(assetId: string, ext: string, opts: MediaConvertOpts): Buffer | null {
  const rows = db
    .select({ data: mediaVariantTable.data })
    .from(mediaVariantTable)
    .where(
      and(
        eq(mediaVariantTable.assetId, decodeId(assetId)),
        eq(mediaVariantTable.ext, ext),
        eq(mediaVariantTable.optsHash, hashOpts(opts as Record<string, unknown>)),
      ),
    )
    .all();

  return rows.length > 0 ? rows[0].data : null;
}

function writeCachedVariant(
  assetId: string,
  ext: string,
  opts: MediaConvertOpts,
  data: Buffer,
): void {
  db.insert(mediaVariantTable)
    .values({
      assetId: decodeId(assetId),
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
