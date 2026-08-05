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
import { db } from "../../infra/db/db";
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
): { id: string; ext: string } {
  const fileId = idFromUrl(originalUrl);
  const ext = extFromUrl(originalUrl) ?? "bin";

  const existing = getFile(fileId, db, { includeData: true });
  if (existing) {
    if (existing.status === "failed") {
      const existingRow = db
        .select({ meta: fileTable.meta })
        .from(fileTable)
        .where(eq(fileTable.id, decodeId(fileId)))
        .get()!;
      const { error: _error, attempts: _attempts, ...meta } = existingRow.meta;
      db.update(fileTable)
        .set({
          status: FileStatus.Pending,
          data: Buffer.from(originalUrl, "utf8"),
          meta: { ...meta, attempts: 0 },
        })
        .where(eq(fileTable.id, decodeId(fileId)))
        .run();
    }
    linkFileToItem(itemId, existing.id);
    return { id: fileId, ext: existing.ext };
  }

  db.insert(fileTable)
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
      },
      data: Buffer.from(originalUrl, "utf8"),
      createdAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoNothing()
    .run();

  linkFileToItem(itemId, fileId);
  return { id: fileId, ext };
}

/**
 * Extract ImageBlocks from content, create pending file rows, and enqueue async
 * download/processing work.
 * Returns the content array with ImageBlock URLs replaced by file ids.
 */
export async function processFiles(opts: {
  itemId: number;
  content: Block[];
  fileStore: FileStore;
  mediaOptimizer?: MediaOptimizer;
  transformMedia?: TransformMediaRule[];
  collection?: string;
  pregenerate?: MediaConvertOpts[];
  /** Collects every file id the item references, so callers can prune the rest. */
  linked?: Set<string>;
}): Promise<Block[]> {
  const {
    itemId,
    content,
    fileStore,
    mediaOptimizer,
    transformMedia,
    collection,
    pregenerate,
    linked,
  } = opts;

  const imageBlocks = content.filter(isImg);
  if (imageBlocks.length === 0) return content;

  // Dedup by file id, then download in parallel
  const seen = new Map<string, Promise<{ id: string; ext: string }>>();
  const blockPromises: Promise<void>[] = [];

  for (const block of imageBlocks) {
    const originalUrl = block[1];
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
        Promise.resolve(
          createPendingFile(
            itemId,
            originalUrl,
            fileStore,
            mediaOptimizer,
            transformMedia,
            pregenerate,
            collection,
          ),
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
 * Creates pending file rows and replaces URLs with file ids.
 * Returns a shallow clone of props with processed values.
 */
export async function processPropertyFiles(opts: {
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
    linked,
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
            Promise.resolve(
              createPendingFile(
                itemId,
                url,
                fileStore,
                mediaOptimizer,
                transformMedia,
                pregenerate,
                collection,
              ),
            ).then(({ id, ext }) => {
              linked?.add(id);
              return `${id}.${ext}`;
            }),
          );
        } else {
          collectProcessedId(url, linked);
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
        Promise.resolve(
          createPendingFile(
            itemId,
            value,
            fileStore,
            mediaOptimizer,
            transformMedia,
            pregenerate,
            collection,
          ),
        ).then(({ id, ext }) => {
          linked?.add(id);
          result[propName] = `${id}.${ext}`;
        }),
      );
    } else if (isFile) {
      collectProcessedId(value, linked);
    }
  }

  await Promise.all(promises);

  return result;
}

export function idFromUrl(url: string): string {
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
