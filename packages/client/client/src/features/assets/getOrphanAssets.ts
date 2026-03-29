import type { AssetData } from "../../infra/types/content-types";
import { eq, isNull } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { assetTable, itemAssetTable } from "../../infra/db/schema";

export function getOrphanAssets(ctx = db): AssetData[] {
  const rows = ctx
    .select({ asset: assetTable })
    .from(assetTable)
    .leftJoin(itemAssetTable, eq(assetTable.id, itemAssetTable.assetId))
    .where(isNull(itemAssetTable.itemId))
    .all();

  return rows.map((row) => assetFromDb(row.asset));
}
