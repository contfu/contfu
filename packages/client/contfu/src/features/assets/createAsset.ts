import type { AssetData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { assetToDb } from "../../infra/db/mappers";
import { assetTable } from "../../infra/db/schema";

export async function createAsset<T extends AssetData>(asset: T, ctx = db): Promise<T> {
  await ctx.insert(assetTable).values(assetToDb(asset));
  return asset;
}
