import type { AssetData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { assetTable } from "../../infra/db/schema";

export async function getAssetByCanonical(canonical: string, ctx = db): Promise<AssetData | null> {
  const dbos = await ctx.select().from(assetTable).where(eq(assetTable.canonical, canonical)).all();
  return dbos.length > 0 ? assetFromDb(dbos[0]) : null;
}
