import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { fileTable, mediaVariantTable } from "../../infra/db/schema";
import type { MediaConvertOpts, MediaTransform } from "../../domain/media";

/**
 * On-demand media conversion with variant caching.
 * Returns the converted buffer, or null if the source file doesn't exist.
 * Caches results in mediaVariantTable for subsequent requests.
 */
export async function convertMedia(
  fileId: string,
  ext: string,
  opts: MediaConvertOpts,
  transform: MediaTransform,
): Promise<Buffer | null> {
  // Find source file by id
  const idBuf = decodeId(fileId);
  const files = db
    .select({ id: fileTable.id, data: fileTable.data })
    .from(fileTable)
    .where(eq(fileTable.id, idBuf))
    .all();

  if (files.length === 0 || !files[0].data) return null;

  const file = { id: files[0].id, data: files[0].data };
  const optsHash = hashOpts(opts as Record<string, unknown>);

  // Check cache by (fileId, ext, optsHash)
  const cached = db
    .select({ data: mediaVariantTable.data })
    .from(mediaVariantTable)
    .where(
      and(
        eq(mediaVariantTable.fileId, file.id),
        eq(mediaVariantTable.ext, ext),
        eq(mediaVariantTable.optsHash, optsHash),
      ),
    )
    .all();

  if (cached.length > 0) return cached[0].data;

  // Convert
  const result = await transform(file.data, opts);

  // Cache
  db.insert(mediaVariantTable)
    .values({
      fileId: file.id,
      ext,
      optsHash,
      opts: opts as Record<string, unknown>,
      size: result.byteLength,
      data: result,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();

  return result;
}
