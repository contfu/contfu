import { createHash, randomBytes } from "node:crypto";
import { isImg, type Block, type CollectionSchema, PropertyType } from "@contfu/core";
import { mimeTypes } from "m4k/lib/util/mime.js";
import { createAsset } from "./createAsset";
import { getAsset } from "./getAsset";
import { linkAssetToItem } from "./linkAssetToItem";
import { db } from "../../infra/db/db";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { mediaVariantTable } from "../../infra/db/schema";
import type {
  AudioConstraints,
  ImageConstraints,
  MediaConstraints,
  MediaOptimizer,
  MediaStore,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VariantDef,
  VariantResult,
  VideoConstraints,
} from "../media/media";

/**
 * Detect media type from file extension using m4k's mimeTypes.
 */
function detectMediaType(url: string): string {
  const ext = extFromUrl(url)?.toLowerCase();
  if (!ext) return "image";
  const mime = mimeTypes[ext];
  if (!mime) return "image";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "image";
}

/**
 * Build combined OptimizeImageOpts from constraints and predefined variants.
 */
function buildImageOptimizerOpts(
  constraints?: ImageConstraints,
  variants?: VariantDef[],
): OptimizeImageOpts {
  const masterFormat = constraints?.format ?? "avif";
  const masterEntry: [number?, number?, number?] = [
    constraints?.maxWidth,
    constraints?.maxHeight,
    constraints?.quality,
  ];

  const variantsByFormat = new Map<string, [number?, number?, number?][]>();
  variantsByFormat.set(masterFormat, [masterEntry]);

  for (const v of variants ?? []) {
    const fmt = v.format ?? masterFormat;
    const entries = variantsByFormat.get(fmt) ?? [];
    entries.push([v.width, v.height, v.quality]);
    variantsByFormat.set(fmt, entries);
  }

  return Object.fromEntries(variantsByFormat) as OptimizeImageOpts;
}

/**
 * Build OptimizeVideoOpts from video constraints.
 */
function buildVideoOptimizerOpts(constraints?: VideoConstraints): OptimizeVideoOpts {
  return {
    format: constraints?.format,
    videoCodec: constraints?.videoCodec,
    videoBitrate: constraints?.videoBitrate,
    width: constraints?.width,
    height: constraints?.height,
    fps: constraints?.fps,
    audioCodec: constraints?.audioCodec,
    audioBitrate: constraints?.audioBitrate,
  };
}

/**
 * Build OptimizeAudioOpts from audio constraints.
 */
function buildAudioOptimizerOpts(constraints?: AudioConstraints): OptimizeAudioOpts {
  return {
    format: constraints?.format,
    codec: constraints?.codec,
    bitrate: constraints?.bitrate,
  };
}

/**
 * Store variant results from the optimizer into the mediaVariantTable.
 */
async function storeVariantRecords(assetId: string, results: VariantResult[]): Promise<void> {
  // Skip the first result (master) — only store additional variants
  if (results.length <= 1) return;

  for (const variant of results.slice(1)) {
    const opts: Record<string, unknown> = {};
    if (variant.width != null) opts.width = variant.width;
    if (variant.height != null) opts.height = variant.height;
    if (variant.quality != null) opts.quality = variant.quality;
    const optsHash = hashOpts(opts);

    await db.insert(mediaVariantTable).values({
      id: randomBytes(16),
      assetId: decodeId(assetId),
      ext: variant.ext,
      optsHash,
      opts,
      size: variant.size,
      data: Buffer.alloc(0), // Data lives in the MediaStore, not duplicated here
      createdAt: Math.floor(Date.now() / 1000),
    });
  }
}

/**
 * Download, optimize, and store a single asset. Returns the asset id.
 * Skips download if an asset with the same id already exists.
 */
async function downloadAndStoreAsset(
  itemId: string,
  originalUrl: string,
  mediaStore: MediaStore,
  mediaOptimizer?: MediaOptimizer,
  mediaConstraints?: MediaConstraints,
  collectionVariants?: VariantDef[],
): Promise<string> {
  const assetId = idFromUrl(originalUrl);
  const ext = extFromUrl(originalUrl) ?? "bin";

  const existing = await getAsset(assetId);
  if (existing) {
    await linkAssetToItem(itemId, existing.id);
    return assetId;
  }

  let res: Response;
  try {
    res = await fetch(originalUrl);
  } catch {
    return assetId;
  }
  if (!res.ok) return assetId;

  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = detectMediaType(originalUrl);
  const constraints = mediaConstraints?.[mediaType as keyof MediaConstraints];
  const storeKey = `${assetId}.${ext}`;

  let masterExt: string;
  let variantResults: VariantResult[] = [];

  if (mediaOptimizer && mediaType === "image") {
    const imageConstraints = constraints as ImageConstraints | undefined;
    const hasConstraints = imageConstraints != null;
    const hasVariants = collectionVariants != null && collectionVariants.length > 0;

    if (hasConstraints || hasVariants) {
      const opts = buildImageOptimizerOpts(imageConstraints, collectionVariants);
      variantResults = await mediaOptimizer.optimize(mediaStore, storeKey, buffer, "image", opts);
    } else {
      variantResults = await mediaOptimizer.optimize(mediaStore, storeKey, buffer, "image");
    }
    masterExt = imageConstraints?.format ?? "avif";
  } else if (mediaOptimizer && mediaType === "video") {
    const videoConstraints = constraints as VideoConstraints | undefined;
    const opts = buildVideoOptimizerOpts(videoConstraints);
    variantResults = await mediaOptimizer.optimize(mediaStore, storeKey, buffer, "video", opts);
    masterExt = videoConstraints?.format ?? ext;
  } else if (mediaOptimizer && mediaType === "audio") {
    const audioConstraints = constraints as AudioConstraints | undefined;
    const opts = buildAudioOptimizerOpts(audioConstraints);
    variantResults = await mediaOptimizer.optimize(mediaStore, storeKey, buffer, "audio", opts);
    masterExt = audioConstraints?.format ?? ext;
  } else {
    await mediaStore.write(storeKey, buffer);
    masterExt = ext;
  }

  await createAsset({
    id: assetId,
    originalUrl,
    mediaType,
    ext: masterExt,
    size: buffer.byteLength,
    createdAt: Math.floor(Date.now() / 1000),
  });

  await linkAssetToItem(itemId, assetId);

  if (variantResults.length > 0) {
    await storeVariantRecords(assetId, variantResults);
  }

  return assetId;
}

/**
 * Extract ImageBlocks from content, download each image, optimize via
 * MediaOptimizer, write to MediaStore, and create asset DB records.
 * Returns the content array with ImageBlock URLs replaced by asset ids.
 */
export async function processAssets(opts: {
  itemId: string;
  content: Block[];
  mediaStore: MediaStore;
  mediaOptimizer?: MediaOptimizer;
  mediaConstraints?: MediaConstraints;
  collectionVariants?: VariantDef[];
}): Promise<Block[]> {
  const { itemId, content, mediaStore, mediaOptimizer, mediaConstraints, collectionVariants } =
    opts;

  const imageBlocks = content.filter(isImg);
  if (imageBlocks.length === 0) return content;

  // Dedup by asset id, then download in parallel
  const seen = new Map<string, Promise<string>>();
  const blockPromises: Promise<void>[] = [];

  for (const block of imageBlocks) {
    const originalUrl = block[1];
    const assetId = idFromUrl(originalUrl);

    if (!seen.has(assetId)) {
      seen.set(
        assetId,
        downloadAndStoreAsset(
          itemId,
          originalUrl,
          mediaStore,
          mediaOptimizer,
          mediaConstraints,
          collectionVariants,
        ),
      );
    }

    blockPromises.push(
      seen.get(assetId)!.then((id) => {
        block[1] = id;
      }),
    );
  }

  await Promise.all(blockPromises);

  return content;
}

/**
 * Process media URLs in item properties (FILE/FILES typed props).
 * Downloads assets and replaces URLs with asset ids.
 * Returns a shallow clone of props with processed values.
 */
export async function processPropertyAssets(opts: {
  itemId: string;
  props: Record<string, unknown>;
  schema: CollectionSchema;
  mediaStore: MediaStore;
  mediaOptimizer?: MediaOptimizer;
  mediaConstraints?: MediaConstraints;
  collectionVariants?: VariantDef[];
}): Promise<Record<string, unknown>> {
  const {
    itemId,
    props,
    schema,
    mediaStore,
    mediaOptimizer,
    mediaConstraints,
    collectionVariants,
  } = opts;
  const result = { ...props };

  const promises: Promise<void>[] = [];

  for (const [propName, propType] of Object.entries(schema)) {
    const isFile = (propType & PropertyType.FILE) !== 0;
    const isFiles = (propType & PropertyType.FILES) !== 0;

    if (!isFile && !isFiles) continue;

    const value = props[propName];
    if (value == null) continue;

    if (isFiles && Array.isArray(value)) {
      const processed: (string | Promise<string>)[] = [];
      for (const url of value) {
        if (typeof url === "string" && url.startsWith("http")) {
          processed.push(
            downloadAndStoreAsset(
              itemId,
              url,
              mediaStore,
              mediaOptimizer,
              mediaConstraints,
              collectionVariants,
            ),
          );
        } else {
          processed.push(url as string);
        }
      }
      promises.push(
        Promise.all(processed).then((resolved) => {
          result[propName] = resolved;
        }),
      );
    } else if (isFile && typeof value === "string" && value.startsWith("http")) {
      promises.push(
        downloadAndStoreAsset(
          itemId,
          value,
          mediaStore,
          mediaOptimizer,
          mediaConstraints,
          collectionVariants,
        ).then((id) => {
          result[propName] = id;
        }),
      );
    }
  }

  await Promise.all(promises);

  return result;
}

function idFromUrl(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  return createHash("sha256").update(pathname).digest("hex").slice(0, 16);
}

function extFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot === -1) return undefined;
    const ext = pathname.slice(dot + 1).toLowerCase();
    return ext.length > 0 && ext.length <= 5 ? ext : undefined;
  } catch {
    return undefined;
  }
}
