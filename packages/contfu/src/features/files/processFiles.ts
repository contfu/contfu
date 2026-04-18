import { createHash } from "node:crypto";
import {
  isImg,
  mimeTypes,
  type Block,
  type CollectionSchema,
  PropertyType,
  schemaType,
} from "@contfu/core";
import { createFile } from "./createFile";
import { getFile } from "./getFile";
import { linkFileToItem } from "./linkFileToItem";
import { db } from "../../infra/db/db";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { mediaVariantTable } from "../../infra/db/schema";
import type {
  ImageConvertOpts,
  MediaConvertOpts,
  MediaOptimizer,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  TransformAudioRule,
  TransformImageRule,
  TransformMediaRule,
  TransformVideoRule,
  VariantResult,
} from "../../domain/media";
import type { FileStore } from "../../domain/files";

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
  constraints?: TransformImageRule,
  variants?: MediaConvertOpts[],
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
    if (v.mediaType && v.mediaType !== "image") continue;
    const img = v as ImageConvertOpts;
    const fmt = img.format ?? masterFormat;
    const entries = variantsByFormat.get(fmt) ?? [];
    entries.push([img.resize?.width, img.resize?.height, img.quality]);
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
function buildVideoOptimizerOpts(constraints?: TransformVideoRule): OptimizeVideoOpts {
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
function buildAudioOptimizerOpts(constraints?: TransformAudioRule): OptimizeAudioOpts {
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
function storeVariantRecords(fileId: string, results: VariantResult[]): void {
  if (results.length === 0) return;

  for (const variant of results) {
    const opts: Record<string, unknown> = {};
    if (variant.width != null) opts.width = variant.width;
    if (variant.height != null) opts.height = variant.height;
    if (variant.quality != null) opts.quality = variant.quality;
    const optsHash = hashOpts(opts);

    db.insert(mediaVariantTable)
      .values({
        fileId: decodeId(fileId),
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
 * Download, optimize, and store a single file. Returns the file id and stored extension.
 * Skips download if an file with the same id already exists.
 */
async function downloadAndStoreFile(
  itemId: string,
  originalUrl: string,
  fileStore: FileStore,
  mediaOptimizer?: MediaOptimizer,
  transformMedia?: TransformMediaRule[],
  pregenerate?: MediaConvertOpts[],
  collection?: string,
): Promise<{ id: string; ext: string }> {
  const fileId = idFromUrl(originalUrl);
  const ext = extFromUrl(originalUrl) ?? "bin";

  const existing = getFile(fileId);
  if (existing) {
    linkFileToItem(itemId, existing.id);
    return { id: fileId, ext: existing.ext };
  }

  let res: Response;
  try {
    res = await fetch(originalUrl);
  } catch {
    return { id: fileId, ext };
  }
  if (!res.ok) return { id: fileId, ext };

  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = detectMediaType(originalUrl);

  // Find matching rule for this media type and collection
  const rule = transformMedia?.find(
    (r) =>
      r.mediaType === mediaType && (!r.collections || r.collections.includes(collection ?? "")),
  );
  const extAllowed = rule ? isExtensionAllowed(ext, rule) : true;

  const storeKey = `${fileId}.${ext}`;

  let masterExt: string;
  let masterData: Buffer;
  let variantResults: VariantResult[] = [];

  if (mediaOptimizer && mediaType === "image" && extAllowed) {
    const imageConstraints = rule as TransformImageRule | undefined;
    const hasConstraints = imageConstraints != null;
    const hasVariants = pregenerate != null && pregenerate.length > 0;

    if (hasConstraints || hasVariants) {
      const opts = buildImageOptimizerOpts(imageConstraints, pregenerate);
      variantResults = await mediaOptimizer.optimize(storeKey, buffer, "image", opts);
    } else {
      variantResults = await mediaOptimizer.optimize(storeKey, buffer, "image");
    }
    masterExt = imageConstraints?.format ?? "avif";
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else if (mediaOptimizer && mediaType === "video" && extAllowed) {
    const videoConstraints = rule as TransformVideoRule | undefined;
    const opts = buildVideoOptimizerOpts(videoConstraints);
    variantResults = await mediaOptimizer.optimize(storeKey, buffer, "video", opts);
    masterExt = videoConstraints?.format ?? ext;
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else if (mediaOptimizer && mediaType === "audio" && extAllowed) {
    const audioConstraints = rule as TransformAudioRule | undefined;
    const opts = buildAudioOptimizerOpts(audioConstraints);
    variantResults = await mediaOptimizer.optimize(storeKey, buffer, "audio", opts);
    masterExt = audioConstraints?.format ?? ext;
    masterData = variantResults.length > 0 ? variantResults[0].data : buffer;
  } else {
    masterExt = ext;
    masterData = buffer;
  }

  // Persist: single INSERT with master data included
  createFile({
    id: fileId,
    originalUrl,
    mediaType,
    ext: masterExt,
    size: buffer.byteLength,
    data: masterData,
    createdAt: Math.floor(Date.now() / 1000),
  });

  linkFileToItem(itemId, fileId);

  if (variantResults.length > 0) {
    storeVariantRecords(fileId, variantResults);
  }

  // Write to fileStore for non-DB store implementations
  for (const result of variantResults) {
    await fileStore.write(result.path, result.data);
  }
  if (variantResults.length === 0) {
    await fileStore.write(storeKey, masterData);
  }

  return { id: fileId, ext: masterExt };
}

/**
 * Extract ImageBlocks from content, download each image, optimize via
 * MediaOptimizer, write to FileStore, and create file DB records.
 * Returns the content array with ImageBlock URLs replaced by file ids.
 */
export async function processFiles(opts: {
  itemId: string;
  content: Block[];
  fileStore: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  pregenerate?: MediaConvertOpts[];
}): Promise<Block[]> {
  const { itemId, content, fileStore, mediaOptimizer, transformMedia, collection, pregenerate } =
    opts;

  const imageBlocks = content.filter(isImg);
  if (imageBlocks.length === 0) return content;

  // Dedup by file id, then download in parallel
  const seen = new Map<string, Promise<{ id: string; ext: string }>>();
  const blockPromises: Promise<void>[] = [];

  for (const block of imageBlocks) {
    const originalUrl = block[1];
    const fileId = idFromUrl(originalUrl);

    if (!seen.has(fileId)) {
      seen.set(
        fileId,
        downloadAndStoreFile(
          itemId,
          originalUrl,
          fileStore,
          mediaOptimizer,
          transformMedia,
          pregenerate,
          collection,
        ),
      );
    }

    blockPromises.push(
      seen.get(fileId)!.then(({ id, ext }) => {
        block[1] = `${id}.${ext}`;
      }),
    );
  }

  await Promise.all(blockPromises);

  return content;
}

/**
 * Process media URLs in item properties (FILE/FILES typed props).
 * Downloads files and replaces URLs with file ids.
 * Returns a shallow clone of props with processed values.
 */
export async function processPropertyFiles(opts: {
  itemId: string;
  props: Record<string, unknown>;
  schema: CollectionSchema;
  fileStore: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  pregenerate?: MediaConvertOpts[];
}): Promise<Record<string, unknown>> {
  const {
    itemId,
    props,
    schema,
    fileStore,
    mediaOptimizer,
    transformMedia,
    collection,
    pregenerate,
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
            downloadAndStoreFile(
              itemId,
              url,
              fileStore,
              mediaOptimizer,
              transformMedia,
              pregenerate,
              collection,
            ).then(({ id, ext }) => `${id}.${ext}`),
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
        downloadAndStoreFile(
          itemId,
          value,
          fileStore,
          mediaOptimizer,
          transformMedia,
          pregenerate,
          collection,
        ).then(({ id, ext }) => {
          result[propName] = `${id}.${ext}`;
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
