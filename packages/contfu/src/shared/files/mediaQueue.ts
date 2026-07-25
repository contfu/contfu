import { and, eq, inArray } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import type { FileStore } from "../../domain/files";
import type {
  ImageConvertOpts,
  MediaConvertOpts,
  MediaMasterConfig,
  MediaOptimizer,
  MediaVariants,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  TransformAudioRule,
  TransformImageRule,
  TransformMediaRule,
  TransformVideoRule,
  VariantResult,
} from "../../domain/media";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable, itemsTable, mediaVariantTable } from "../../infra/db/schema";
import { hashObject } from "../../infra/hash";
import { createOrUpdateMediaMaster } from "../../features/files/createOrUpdateMediaMaster";
import { rederiveFileFromMediaMaster } from "../../features/files/rederiveFileFromMediaMaster";
import { decodeId, encodeId } from "../../infra/ids";
import { fileStore as defaultFileStore } from "../../infra/media/media-defaults";
import { extFromUrl, isExtensionAllowed } from "./processFiles";

type QueueOptions = {
  fileStore?: FileStore;
  mediaOptimizer?: MediaOptimizer;
  mediaMaster?: false | MediaMasterConfig;
  transformMedia?: TransformMediaRule[];
  mediaVariants?: MediaVariants;
  concurrency?: number;
  onCloudRepair?: (request: { collection: string; itemIds: number[]; source: true }) => void;
};

type QueuedFile = { due: number; id: Buffer };

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let scheduledDue: number | undefined;
let options: QueueOptions = {};
const queue: QueuedFile[] = [];

export function configureMediaQueue(opts: QueueOptions): void {
  options = { ...options, ...opts };
  resumeMediaQueue();
}

export function resumeMediaQueue(): void {
  enqueuePendingFiles(Date.now());
}

function enqueuePendingFiles(due: number): void {
  const pending = db
    .select({ id: fileTable.id })
    .from(fileTable)
    .where(eq(fileTable.status, FileStatus.Pending))
    .all();
  for (const file of pending) enqueueFile({ due, id: file.id });
}

function enqueueFile(file: QueuedFile): void {
  const existing = queue.findIndex((entry) => entry.id.equals(file.id));
  if (existing >= 0) {
    if (queue[existing].due <= file.due) return;
    queue.splice(existing, 1);
  }

  const index = insertionIndex(file.due);
  queue.splice(index, 0, file);
  scheduleQueue(index === 0);
}

function insertionIndex(due: number): number {
  let low = 0;
  let high = queue.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (queue[mid].due <= due) low = mid + 1;
    else high = mid;
  }
  return low;
}

function scheduleQueue(insertedFirst = false): void {
  const next = queue[0];
  if (!next) return;
  if (running) return;
  if (scheduledDue != null && !insertedFirst) return;
  if (timer) clearTimeout(timer);
  scheduledDue = next.due;
  const delay = next.due - Date.now();
  if (delay <= 0) {
    scheduledDue = undefined;
    void drain();
    return;
  }
  timer = setTimeout(() => {
    scheduledDue = undefined;
    void drain();
  }, delay);
  timer.unref?.();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const concurrency = Math.max(1, options.concurrency ?? 2);
    while (true) {
      const files = nextDueBatch(concurrency);
      if (files.length === 0) break;
      await Promise.all(files.map((file) => processOne(file)));
    }
  } finally {
    running = false;
    scheduleQueue();
  }
}

function nextDueBatch(limit: number): (typeof fileTable.$inferSelect)[] {
  const dueIds = popDueIds(Date.now(), limit);
  if (dueIds.length === 0) return [];
  return db
    .select()
    .from(fileTable)
    .where(and(eq(fileTable.status, FileStatus.Pending), inIds(dueIds)))
    .all();
}

function inIds(ids: Buffer[]) {
  return ids.length === 1 ? eq(fileTable.id, ids[0]) : inArray(fileTable.id, ids);
}

function popDueIds(now: number, limit: number): Buffer[] {
  const ids: Buffer[] = [];
  while (ids.length < limit && queue[0] && queue[0].due <= now) {
    ids.push(queue.shift()!.id);
  }
  return ids;
}

function backoff(attempts: number): number {
  return Math.min(30 * 60_000, 1000 * 2 ** Math.min(attempts, 10));
}

function isPermanent(error: unknown): boolean {
  if (error instanceof Response)
    return (
      error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
    );
  return false;
}

function isCloudRepairable(error: unknown): boolean {
  return error instanceof Response && [401, 403, 404].includes(error.status);
}

function requestCloudRepair(file: typeof fileTable.$inferSelect): void {
  const fallbackCollection =
    typeof file.meta?.collection === "string" ? file.meta.collection : null;
  const rows = db
    .select({ itemId: itemsTable.id, collection: itemsTable.collection })
    .from(itemFileTable)
    .innerJoin(itemsTable, eq(itemsTable.id, itemFileTable.itemId))
    .where(eq(itemFileTable.fileId, file.id))
    .all();
  const byCollection = new Map<string, number[]>();
  for (const row of rows) {
    const itemIds = byCollection.get(row.collection) ?? [];
    itemIds.push(row.itemId);
    byCollection.set(row.collection, itemIds);
  }
  if (byCollection.size === 0 && fallbackCollection) byCollection.set(fallbackCollection, []);
  for (const [collection, itemIds] of byCollection) {
    options.onCloudRepair?.({ collection, itemIds, source: true });
  }
}

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

async function sourceMetadata(mediaType: string, input: Buffer) {
  const canReadMetadata = mediaType === "image" || mediaType === "video" || mediaType === "audio";
  if (!canReadMetadata || !options.mediaOptimizer?.metadata) return {};
  return options.mediaOptimizer.metadata(input, mediaType);
}

function storeVariantRecords(fileId: string, results: VariantResult[]): void {
  for (const variant of results) {
    const opts: Record<string, unknown> = {};
    if (variant.width != null) opts.width = variant.width;
    if (variant.height != null) opts.height = variant.height;
    if (variant.quality != null) opts.quality = variant.quality;
    db.insert(mediaVariantTable)
      .values({
        fileId: decodeId(fileId),
        ext: variant.ext,
        optsHash: hashObject(opts),
        opts,
        size: variant.size,
        data: variant.data,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoUpdate({
        target: [mediaVariantTable.fileId, mediaVariantTable.ext, mediaVariantTable.optsHash],
        set: {
          opts,
          size: variant.size,
          data: variant.data,
          createdAt: Math.floor(Date.now() / 1000),
        },
      })
      .run();
  }
}

export async function optimizeFile(
  storeKey: string,
  input: Buffer,
  mediaType: string,
  originalExt: string,
  meta: Record<string, unknown>,
): Promise<{ data: Buffer; ext: string; variants: VariantResult[] }> {
  const optimizer = options.mediaOptimizer;
  if (!optimizer) return { data: input, ext: originalExt, variants: [] };

  const transformMedia = Array.isArray(meta.transformMedia)
    ? (meta.transformMedia as TransformMediaRule[])
    : undefined;
  const collection = typeof meta.collection === "string" ? meta.collection : undefined;
  const pregenerate = Array.isArray(meta.pregenerate)
    ? (meta.pregenerate as MediaConvertOpts[])
    : undefined;
  const rule = transformMedia?.find(
    (r) =>
      r.mediaType === mediaType && (!r.collections || r.collections.includes(collection ?? "")),
  );
  if (rule && !isExtensionAllowed(originalExt, rule))
    return { data: input, ext: originalExt, variants: [] };

  let variants: VariantResult[] = [];
  if (mediaType === "image") {
    const imageRule = rule as TransformImageRule | undefined;
    variants =
      imageRule || pregenerate?.length
        ? await optimizer.optimize(
            storeKey,
            input,
            "image",
            buildImageOptimizerOpts(imageRule, pregenerate),
          )
        : await optimizer.optimize(storeKey, input, "image");
    return {
      data: variants[0]?.data ?? input,
      ext: imageRule?.format ?? variants[0]?.ext ?? "avif",
      variants,
    };
  }
  if (mediaType === "video") {
    const videoRule = rule as TransformVideoRule | undefined;
    variants = await optimizer.optimize(
      storeKey,
      input,
      "video",
      buildVideoOptimizerOpts(videoRule),
    );
    return {
      data: variants[0]?.data ?? input,
      ext: videoRule?.format ?? variants[0]?.ext ?? originalExt,
      variants,
    };
  }
  if (mediaType === "audio") {
    const audioRule = rule as TransformAudioRule | undefined;
    variants = await optimizer.optimize(
      storeKey,
      input,
      "audio",
      buildAudioOptimizerOpts(audioRule),
    );
    return {
      data: variants[0]?.data ?? input,
      ext: audioRule?.format ?? variants[0]?.ext ?? originalExt,
      variants,
    };
  }
  return { data: input, ext: originalExt, variants: [] };
}

async function processOne(file: typeof fileTable.$inferSelect): Promise<void> {
  const meta = file.meta ?? {};
  const attempts = typeof meta.attempts === "number" ? meta.attempts + 1 : 1;
  const sourceUrl = file.data?.toString("utf8");
  if (!sourceUrl) {
    fail(file, attempts, "Missing source URL", true);
    requestCloudRepair(file);
    return;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw response;
    const input = Buffer.from(await response.arrayBuffer());
    const originalExt = typeof meta.ext === "string" ? meta.ext : (extFromUrl(sourceUrl) ?? "bin");
    const id = encodeId(file.id);
    const storeKey = `${id}.${originalExt}`;
    const master = await createOrUpdateMediaMaster({
      fileId: file.id,
      input,
      mediaType: file.mediaType,
      originalExt,
      meta,
      mediaOptimizer: options.mediaOptimizer,
      mediaMaster: options.mediaMaster,
    });
    const sourceForOutput = master?.data ?? input;
    const storeKeyForOutput = master ? `${id}.${master.ext}` : storeKey;
    const processed = await optimizeFile(
      storeKeyForOutput,
      sourceForOutput,
      file.mediaType,
      originalExt,
      meta,
    );
    await writeProcessedOutputs(id, processed);
    const metadata = await sourceMetadata(file.mediaType, input);
    const {
      sourceUrl: _sourceUrl,
      transformMedia: _transformMedia,
      pregenerate: _pregenerate,
      collection: _collection,
      error: _error,
      ...readyMeta
    } = meta;
    db.update(fileTable)
      .set({
        status: FileStatus.Ready,
        data: processed.data,
        meta: {
          ...readyMeta,
          ext: processed.ext,
          size: input.byteLength,
          ...metadata,
          attempts,
          mediaMaster: master
            ? { ext: master.ext, configFingerprint: master.fingerprint, metadata: master.metadata }
            : undefined,
        },
      })
      .where(eq(fileTable.id, file.id))
      .run();
  } catch (error) {
    const cloudRepairable = isCloudRepairable(error);
    fail(
      file,
      attempts,
      error instanceof Response ? `HTTP ${error.status}` : String(error),
      isPermanent(error) || attempts >= 100,
    );
    if (cloudRepairable) requestCloudRepair(file);
  }
}

export async function writeProcessedOutputs(
  id: string,
  processed: { data: Buffer; ext: string; variants: VariantResult[] },
): Promise<void> {
  const store = options.fileStore ?? defaultFileStore;
  await store.write(`${id}.${processed.ext}`, processed.data);
  for (const variant of processed.variants) await store.write(variant.path, variant.data);
  storeVariantRecords(id, processed.variants);
}

export async function reconcileConfiguredMediaMasters(): Promise<void> {
  const { reconcileMediaMasters } = await import("../../features/files/reconcileMediaMasters");
  await reconcileMediaMasters({
    mediaOptimizer: options.mediaOptimizer,
    mediaMaster: options.mediaMaster,
    transformMedia: options.transformMedia,
    mediaVariants: options.mediaVariants,
    rederive: (file, master) =>
      rederiveFileFromMediaMaster({
        file,
        master,
        mediaMaster: options.mediaMaster,
        optimize: optimizeFile,
        writeOutputs: writeProcessedOutputs,
      }),
    onMissingMaster: requestCloudRepair,
  });
}

function fail(
  file: typeof fileTable.$inferSelect,
  attempts: number,
  error: string,
  permanent: boolean,
): void {
  const meta = file.meta ?? {};
  db.update(fileTable)
    .set({
      status: permanent ? FileStatus.Failed : FileStatus.Pending,
      meta: { ...meta, attempts, error },
    })
    .where(eq(fileTable.id, file.id))
    .run();
  if (!permanent) {
    enqueueFile({ due: Date.now() + backoff(attempts), id: file.id });
  }
}
