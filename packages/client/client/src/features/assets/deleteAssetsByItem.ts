import { eq, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable, itemAssetTable } from "../../infra/db/schema";

export function deleteAssetsByItem(itemId: string, ctx = db): void {
  const itemIdBuf = decodeId(itemId);

  // Get asset IDs linked to this item before removing the links
  const linkedAssets = ctx
    .select({ assetId: itemAssetTable.assetId })
    .from(itemAssetTable)
    .where(eq(itemAssetTable.itemId, itemIdBuf))
    .all();

  // Remove junction rows for this item
  ctx.delete(itemAssetTable).where(eq(itemAssetTable.itemId, itemIdBuf)).run();

  // Delete orphan assets (no remaining links in itemAssetTable)
  for (const { assetId } of linkedAssets) {
    const remaining = ctx
      .select({ count: sql<number>`count(*)` })
      .from(itemAssetTable)
      .where(eq(itemAssetTable.assetId, assetId))
      .all();

    if (remaining[0].count === 0) {
      ctx.delete(assetTable).where(eq(assetTable.id, assetId)).run();
    }
  }
}
