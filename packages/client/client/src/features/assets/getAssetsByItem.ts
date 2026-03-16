import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { assetFromDb } from "../../infra/db/mappers";
import { assetTable, itemAssetTable } from "../../infra/db/schema";
import { decodeId } from "../../infra/ids";
import type { AssetData } from "../../infra/types/content-types";

export function getAssetsByItem(itemId: string, ctx = db): AssetData[] {
  const rows = ctx
    .select({ asset: assetTable })
    .from(itemAssetTable)
    .innerJoin(assetTable, eq(itemAssetTable.assetId, assetTable.id))
    .where(eq(itemAssetTable.itemId, decodeId(itemId)))
    .all();

  return rows.map((row) => assetFromDb(row.asset));
}
