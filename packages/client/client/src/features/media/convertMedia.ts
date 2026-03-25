import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { hashOpts } from "../../infra/hash";
import { decodeId } from "../../infra/ids";
import { assetTable, mediaVariantTable } from "../../infra/db/schema";
import type { MediaConvertOpts, MediaTransform } from "./media";

/**
 * On-demand media conversion with variant caching.
 * Returns the converted buffer, or null if the source asset doesn't exist.
 * Caches results in mediaVariantTable for subsequent requests.
 */
export async function convertMedia(
  assetId: string,
  ext: string,
  opts: MediaConvertOpts,
  transform: MediaTransform,
): Promise<Buffer | null> {
  // Find source asset by id
  const idBuf = decodeId(assetId);
  const assets = db
    .select({ id: assetTable.id, data: assetTable.data })
    .from(assetTable)
    .where(eq(assetTable.id, idBuf))
    .all();

  if (assets.length === 0 || !assets[0].data) return null;

  const asset = { id: assets[0].id, data: assets[0].data };
  const optsHash = hashOpts(opts as Record<string, unknown>);

  // Check cache by (assetId, ext, optsHash)
  const cached = db
    .select({ data: mediaVariantTable.data })
    .from(mediaVariantTable)
    .where(
      and(
        eq(mediaVariantTable.assetId, asset.id),
        eq(mediaVariantTable.ext, ext),
        eq(mediaVariantTable.optsHash, optsHash),
      ),
    )
    .all();

  if (cached.length > 0) return cached[0].data;

  // Convert
  const result = await transform(asset.data, opts);

  // Cache
  db.insert(mediaVariantTable)
    .values({
      id: randomBytes(16),
      assetId: asset.id,
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
