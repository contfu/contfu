import type { AssetData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { assetToDb } from "../../infra/db/mappers";
import { assetTable } from "../../infra/db/schema";

export function createAsset<T extends AssetData>(asset: T, ctx = db): T {
  ctx.insert(assetTable).values(assetToDb(asset)).run();
  return asset;
}
