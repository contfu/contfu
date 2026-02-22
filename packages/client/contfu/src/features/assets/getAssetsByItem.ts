import type { AssetData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable, itemAssetTable } from "../../infra/db/schema";

export async function getAssetsByItem(itemId: string, ctx = db): Promise<AssetData[]> {
  const rows = await ctx
    .select({ asset: assetTable })
    .from(itemAssetTable)
    .innerJoin(assetTable, eq(itemAssetTable.assetId, assetTable.id))
    .where(eq(itemAssetTable.itemId, decodeId(itemId)))
    .all();

  return rows.map((row) => assetFromDb(row.asset));
}
