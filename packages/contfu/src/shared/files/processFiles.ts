import { createHash } from "node:crypto";
import {
  isImg,
  mimeTypes,
  type Block,
  type CollectionSchema,
  PropertyType,
  schemaType,
} from "@contfu/core";
import { eq } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import { getFile } from "../../features/files/getFile";
import { linkFileToItem } from "../../features/files/linkFileToItem";
import { db, type DbCtx } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { fileTable } from "../../infra/db/schema";
import type { MediaConvertOpts, MediaOptimizer, TransformMediaRule } from "../../domain/media";
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

/** File ids are 16 url-safe chars, stored in props and content as `<id>.<ext>`. */
const PROCESSED_REF = /^([A-Za-z0-9_-]{16})\.[A-Za-z0-9]{1,5}$/;

export type FileLinkParts = { stableUrl: string; leaseUrl?: string; expiresAt?: number };
function fileLinkParts(value: unknown): FileLinkParts | null {
  if (typeof value === "string") return { stableUrl: value };
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    (value.length < 3 || (typeof value[2] === "number" && Number.isFinite(value[2])))
  ) {
    return { stableUrl: value[0], leaseUrl: value[1], expiresAt: value[2] as number | undefined };
  }
  return null;
}

/**
 * Record an already-processed `<id>.<ext>` reference as still in use. Values that
 * went through a previous sync no longer carry their remote URL, so without this
 * they would look unreferenced to the caller pruning stale links.
 */
function collectProcessedId(value: unknown, linked?: Set<string>): void {
  if (!linked || typeof value !== "string") return;
  const match = PROCESSED_REF.exec(value);
  if (match) linked.add(match[1]);
}

/**
 * Create a pending file row. Returns the file id and expected stored extension.
 * Skips creation if a file with the same id already exists.
 */
function createPendingFile(
  itemId: number,
  originalUrl: string,
  _fileStore: FileStore,
  _mediaOptimizer?: MediaOptimizer,
  _transformMedia?: TransformMediaRule[],
  _pregenerate?: MediaConvertOpts[],
  _collection?: string,
  lease?: { url: string; expiresAt: number },
  ctx = db,
): { id: string; ext: string } {
  const fileId = idFromUrl(originalUrl);
  const ext = extFromUrl(originalUrl) ?? "bin";

  const existing = getFile(fileId, ctx, { includeData: true });
  if (existing) {
    if (existing.status === "failed") {
      const existingRow = ctx
        .select({ meta: fileTable.meta })
        .from(fileTable)
        .where(eq(fileTable.id, decodeId(fileId)))
        .get()!;
      const { error: _error, attempts: _attempts, ...meta } = existingRow.meta;
      ctx
        .update(fileTable)
        .set({
          status: FileStatus.Pending,
          data: Buffer.from(originalUrl, "utf8"),
          meta: { ...meta, attempts: 0 },
        })
        .where(eq(fileTable.id, decodeId(fileId)))
        .run();
    }
    if (lease) {
      const existingMeta = ctx
        .select({ meta: fileTable.meta })
        .from(fileTable)
        .where(eq(fileTable.id, decodeId(fileId)))
        .get()?.meta;
      ctx
        .update(fileTable)
        .set({
          meta: { ...existingMeta, leaseUrl: lease.url, leaseExpiresAt: lease.expiresAt },
        })
        .where(eq(fileTable.id, decodeId(fileId)))
        .run();
    }
    linkFileToItem(itemId, existing.id, ctx);
    return { id: fileId, ext: existing.ext };
  }

  ctx
    .insert(fileTable)
    .values({
      id: decodeId(fileId),
      status: FileStatus.Pending,
      mediaType: detectMediaType(originalUrl),
      meta: {
        ext,
        size: 0,
        attempts: 0,
        transformMedia: _transformMedia,
        pregenerate: _pregenerate,
        collection: _collection,
        ...(lease ? { leaseUrl: lease.url, leaseExpiresAt: lease.expiresAt } : {}),
      },
      data: Buffer.from(originalUrl, "utf8"),
      createdAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoNothing()
    .run();

  linkFileToItem(itemId, fileId, ctx);
  return { id: fileId, ext };
}

/**
 * Extract ImageBlocks from content, create pending file rows, and enqueue async
 * download/processing work.
 * Returns the content array with ImageBlock URLs replaced by file ids.
 */
export function processFilesSync(opts: {
  itemId: number;
  content: Block[];
  fileStore: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  pregenerate?: MediaConvertOpts[];
  /** Collects every file id the item references, so callers can prune the rest. */
  linked?: Set<string>;
  ctx?: DbCtx;
}): Block[] {
  const {
    itemId,
    content,
    fileStore,
    mediaOptimizer,
    transformMedia,
    collection,
    pregenerate,
    linked,
    ctx = db,
  } = opts;

  const imageBlocks = content.filter(isImg);
  if (imageBlocks.length === 0) return content;

  // Database preparation is synchronous so it can run inside an event transaction.
  const seen = new Map<string, { id: string; ext: string }>();

  for (const block of imageBlocks) {
    const link = fileLinkParts(block[1]);
    if (!link) continue;
    const originalUrl = link.stableUrl;
    // Content that already went through a sync carries `<id>.<ext>`, which must not
    // be hashed again — it only needs to count as referenced.
    if (PROCESSED_REF.test(originalUrl)) {
      collectProcessedId(originalUrl, linked);
      continue;
    }
    const fileId = idFromUrl(originalUrl);
    linked?.add(fileId);

    if (!seen.has(fileId)) {
      seen.set(
        fileId,
        createPendingFile(
          itemId,
          originalUrl,
          fileStore,
          mediaOptimizer,
          transformMedia,
          pregenerate,
          collection,
          link.leaseUrl && link.expiresAt
            ? { url: link.leaseUrl, expiresAt: link.expiresAt }
            : undefined,
          ctx,
        ),
      );
    }

    const resolved = seen.get(fileId)!;
    block[1] = `${resolved.id}.${resolved.ext}`;
  }

  return content;
}

/**
 * Process media URLs in item properties (FILE/FILES typed props).
 * Creates pending file rows and replaces URLs with file ids.
 * Returns a shallow clone of props with processed values.
 */
export function processPropertyFilesSync(opts: {
  itemId: number;
  props: Record<string, unknown>;
  schema: CollectionSchema;
  fileStore: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  pregenerate?: MediaConvertOpts[];
  /** Collects every file id the item references, so callers can prune the rest. */
  linked?: Set<string>;
  ctx?: DbCtx;
}): Record<string, unknown> {
  const {
    itemId,
    props,
    schema,
    fileStore,
    mediaOptimizer,
    transformMedia,
    collection,
    pregenerate,
    linked,
    ctx = db,
  } = opts;
  const result = { ...props };

  for (const [propName, propValue] of Object.entries(schema)) {
    const propType = schemaType(propValue);
    const isFile = (propType & PropertyType.FILE) !== 0;
    const isFiles = (propType & PropertyType.FILES) !== 0;

    if (!isFile && !isFiles) continue;

    const value = props[propName];
    if (value == null) continue;

    if (isFiles && Array.isArray(value)) {
      const processed: string[] = [];
      for (const url of value) {
        const link = fileLinkParts(url);
        if (link && link.stableUrl.startsWith("http")) {
          const { id, ext } = createPendingFile(
            itemId,
            link.stableUrl,
            fileStore,
            mediaOptimizer,
            transformMedia,
            pregenerate,
            collection,
            link.leaseUrl && link.expiresAt
              ? { url: link.leaseUrl, expiresAt: link.expiresAt }
              : undefined,
            ctx,
          );
          linked?.add(id);
          processed.push(`${id}.${ext}`);
        } else {
          collectProcessedId(url, linked);
          processed.push(url as string);
        }
      }
      result[propName] = processed;
    } else if (isFile && fileLinkParts(value)?.stableUrl.startsWith("http")) {
      const link = fileLinkParts(value)!;
      const { id, ext } = createPendingFile(
        itemId,
        link.stableUrl,
        fileStore,
        mediaOptimizer,
        transformMedia,
        pregenerate,
        collection,
        link.leaseUrl && link.expiresAt
          ? { url: link.leaseUrl, expiresAt: link.expiresAt }
          : undefined,
        ctx,
      );
      linked?.add(id);
      result[propName] = `${id}.${ext}`;
    } else if (isFile) {
      collectProcessedId(value, linked);
    }
  }

  return result;
}

/**
 * Async compatibility wrapper for callers that process files outside a database
 * transaction. Database preparation itself remains synchronous so it can be
 * composed into the atomic sync-event transaction.
 */
export function processFiles(opts: Parameters<typeof processFilesSync>[0]): Promise<Block[]> {
  return Promise.resolve(processFilesSync(opts));
}

/** Async compatibility wrapper for property-file processing callers. */
export function processPropertyFiles(
  opts: Parameters<typeof processPropertyFilesSync>[0],
): Promise<Record<string, unknown>> {
  return Promise.resolve(processPropertyFilesSync(opts));
}

function idFromUrl(url: string): string {
  let identity: string;
  try {
    const parsed = new URL(url);
    // Origin prevents separate remote tenants with identical paths from sharing a file.
    // Queries are deliberately excluded so refreshed signed URLs retain their identity.
    identity = `${parsed.origin}${parsed.pathname}`;
  } catch {
    identity = url;
  }
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
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
