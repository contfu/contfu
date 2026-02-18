import type { AssetData } from "../../infra/types/content-types";
import { notInArray } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { assetTable, itemsTable } from "../../infra/db/schema";

export async function getOrphanAssets(ctx = db): Promise<AssetData[]> {
  const items = await ctx.select().from(itemsTable).all();
  const itemIds = items.map((item) => item.id);

  if (itemIds.length === 0) {
    const allAssets = await ctx.select().from(assetTable).all();
    return allAssets.map((dbo) => assetFromDb(dbo));
  }

  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(notInArray(assetTable.itemId, itemIds))
    .all();

  return dbos.map((dbo) => assetFromDb(dbo));
}
