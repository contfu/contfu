import type { AssetData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable } from "../../infra/db/schema";

export async function getAssetsByItem(itemId: string, ctx = db): Promise<AssetData[]> {
  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(eq(assetTable.itemId, decodeId(itemId)))
    .all();

  return dbos.map((dbo) => assetFromDb(dbo));
}
