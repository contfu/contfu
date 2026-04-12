import { createHash } from "node:crypto";
import {
  isImg,
  mimeTypes,
  type Block,
  type CollectionSchema,
  PropertyType,
  schemaType,
} from "@contfu/core";
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
  MediaOptimizer,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  TransformMediaRule,
  VariantDef,
  VariantResult,
  VideoConstraints,
} from "../../domain/media";
import type { AssetStore } from "../../domain/assets";

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
 * Check whether an extension is allowed by a rule's include/exclude filter.
 */
export function isExtensionAllowed(ext: string, rule: TransformMediaRule): boolean {
  const normalized = ext.toLowerCase();
  if (rule.include) return rule.include.includes(normalized);
  if (rule.exclude) return !rule.exclude.includes(normalized);
  return true;
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
    constraints?.resize?.width,
    constraints?.resize?.height,
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

  const result = Object.fromEntries(variantsByFormat) as OptimizeImageOpts;

  // Attach base transform options
  const base: NonNullable<OptimizeImageOpts["base"]> = {};
  if (constraints?.rotate != null) base.rotate = constraints.rotate;
  if (constraints?.crop) base.crop = constraints.crop;
  if (constraints?.keepMetadata) base.keepMetadata = constraints.keepMetadata;
  if (constraints?.keepExif) base.keepExif = constraints.keepExif;
  if (constraints?.keepIcc) base.keepIcc = constraints.keepIcc;
  if (constraints?.colorspace) base.colorspace = constraints.colorspace;
  if (Object.keys(base).length > 0) result.base = base;

  return result;
}

/**
 * Build OptimizeVideoOpts from video constraints.
 */
function buildVideoOptimizerOpts(constraints?: VideoConstraints): OptimizeVideoOpts {
  return {
    format: constraints?.format,
    ext: constraints?.ext,
    videoCodec: constraints?.videoCodec,
    videoBitrate: constraints?.videoBitrate,
    videoFilters: constraints?.videoFilters,
    audioCodec: constraints?.audioCodec,
    audioBitrate: constraints?.audioBitrate,
    audioFilters: constraints?.audioFilters,
    fps: constraints?.fps,
    size: constraints?.size,
    width: constraints?.width,
    height: constraints?.height,
    aspect: constraints?.aspect,
    frames: constraints?.frames,
    duration: constraints?.duration,
    seek: constraints?.seek,
    inputFormat: constraints?.inputFormat,
    pad: constraints?.pad,
    complexFilters: constraints?.complexFilters,
    args: constraints?.args,
  };
}

/**
 * Build OptimizeAudioOpts from audio constraints.
 */
function buildAudioOptimizerOpts(constraints?: AudioConstraints): OptimizeAudioOpts {
  return {
    format: constraints?.format,
    ext: constraints?.ext,
    codec: constraints?.codec,
    bitrate: constraints?.bitrate,
    filters: constraints?.filters,
    complexFilters: constraints?.complexFilters,
    duration: constraints?.duration,
    seek: constraints?.seek,
    inputFormat: constraints?.inputFormat,
    args: constraints?.args,
  };
}

/**
 * Store variant results from the optimizer into the mediaVariantTable.
 */
function storeVariantRecords(assetId: string, results: VariantResult[]): void {
  if (results.length === 0) return;

  for (const variant of results) {
    const opts: Record<string, unknown> = {};
    if (variant.width != null) opts.width = variant.width;
    if (variant.height != null) opts.height = variant.height;
    if (variant.quality != null) opts.quality = variant.quality;
    const optsHash = hashOpts(opts);

    db.insert(mediaVariantTable)
      .values({
        assetId: decodeId(assetId),
        ext: variant.ext,
        optsHash,
        opts,
        size: variant.size,
        data: variant.data,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .run();
  }
}

/**
 * Download, optimize, and store a single asset. Returns the asset id.
 * Skips download if an asset with the same id already exists.
 */
async function downloadAndStoreAsset(
  itemId: string,
  originalUrl: string,
  assetStore: AssetStore,
  mediaOptimizer?: MediaOptimizer,
  transformMedia?: TransformMediaRule[],
  collectionVariants?: VariantDef[],
  collection?: string,
): Promise<string> {
  const assetId = idFromUrl(originalUrl);
  const ext = extFromUrl(originalUrl) ?? "bin";

  const existing = getAsset(assetId);
  if (existing) {
    linkAssetToItem(itemId, existing.id);
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

  // Find matching rule for this media type and collection
  const rule = transformMedia?.find(
    (r) =>
      r.mediaType === mediaType && (!r.collections || r.collections.includes(collection ?? "")),
  );
  const extAllowed = rule ? isExtensionAllowed(ext, rule) : true;

  const storeKey = `${assetId}.${ext}`;

  let masterExt: string;
  let masterData: Buffer;
  let variantResults: VariantResult[] = [];

  if (mediaOptimizer && mediaType === "image" && extAllowed) {
    const imageConstraints = rule as ImageConstraints | undefined;
    const hasConstraints = imageConstraints != null;
    const hasVariants = collectionVariants != null && collectionVariants.length > 0;

    if (hasConstraints || hasVariants) {
      const opts = buildImageOptimizerOpts(imageConstraints, collectionVariants);
      variantResults = await mediaOptimizer.optimize(storeKey, buffer, "image", opts);
    } else {
      variantResults = await mediaOptimizer.optimize(storeKey, buffer, "image");
    }
    masterExt = imageConstraints?.format ?? "avif";
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else if (mediaOptimizer && mediaType === "video" && extAllowed) {
    const videoConstraints = rule as VideoConstraints | undefined;
    const opts = buildVideoOptimizerOpts(videoConstraints);
    variantResults = await mediaOptimizer.optimize(storeKey, buffer, "video", opts);
    masterExt = videoConstraints?.format ?? ext;
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else if (mediaOptimizer && mediaType === "audio" && extAllowed) {
    const audioConstraints = rule as AudioConstraints | undefined;
    const opts = buildAudioOptimizerOpts(audioConstraints);
    variantResults = await mediaOptimizer.optimize(storeKey, buffer, "audio", opts);
    masterExt = audioConstraints?.format ?? ext;
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else {
    masterExt = ext;
    masterData = buffer;
  }

  // Persist: single INSERT with master data included
  createAsset({
    id: assetId,
    originalUrl,
    mediaType,
    ext: masterExt,
    size: buffer.byteLength,
    data: masterData,
    createdAt: Math.floor(Date.now() / 1000),
  });

  linkAssetToItem(itemId, assetId);

  if (variantResults.length > 0) {
    storeVariantRecords(assetId, variantResults);
  }

  // Write to assetStore for non-DB store implementations
  for (const result of variantResults) {
    await assetStore.write(result.path, result.data);
  }
  if (variantResults.length === 0) {
    await assetStore.write(storeKey, masterData);
  }

  return assetId;
}

/**
 * Extract ImageBlocks from content, download each image, optimize via
 * MediaOptimizer, write to AssetStore, and create asset DB records.
 * Returns the content array with ImageBlock URLs replaced by asset ids.
 */
export async function processAssets(opts: {
  itemId: string;
  content: Block[];
  assetStore: AssetStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  collectionVariants?: VariantDef[];
}): Promise<Block[]> {
  const {
    itemId,
    content,
    assetStore,
    mediaOptimizer,
    transformMedia,
    collection,
    collectionVariants,
  } = opts;

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
          assetStore,
          mediaOptimizer,
          transformMedia,
          collectionVariants,
          collection,
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
  assetStore: AssetStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  collectionVariants?: VariantDef[];
}): Promise<Record<string, unknown>> {
  const {
    itemId,
    props,
    schema,
    assetStore,
    mediaOptimizer,
    transformMedia,
    collection,
    collectionVariants,
  } = opts;
  const result = { ...props };

  const promises: Promise<void>[] = [];

  for (const [propName, propValue] of Object.entries(schema)) {
    const propType = schemaType(propValue);
    const isFile = (propType & PropertyType.FILE) !== 0;
    const isFiles = (propType & PropertyType.FILES) !== 0;

    if (!isFile && !isFiles) continue;

    const value = props[propName];
    if (value == null) continue;

    if (isFiles && Array.isArray(value)) {
      const processed: Promise<string>[] = [];
      for (const url of value) {
        if (typeof url === "string" && url.startsWith("http")) {
          processed.push(
            downloadAndStoreAsset(
              itemId,
              url,
              assetStore,
              mediaOptimizer,
              transformMedia,
              collectionVariants,
              collection,
            ),
          );
        } else {
          processed.push(Promise.resolve(url as string));
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
          assetStore,
          mediaOptimizer,
          transformMedia,
          collectionVariants,
          collection,
        ).then((id) => {
          result[propName] = id;
        }),
      );
    }
  }

  await Promise.all(promises);

  return result;
}

export function idFromUrl(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  return createHash("sha256").update(pathname).digest("hex").slice(0, 16);
}

export function extFromUrl(url: string): string | undefined {
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
