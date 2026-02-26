import { isNotNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { assetTable, mediaVariantTable } from "../../infra/db/schema";

export async function countAssets() {
  return db.$count(assetTable);
}

export async function countDownloadedAssets() {
  return db.$count(assetTable, isNotNull(assetTable.data));
}

export async function countProcessedAssets() {
  const rows = await db
    .selectDistinct({ assetId: mediaVariantTable.assetId })
    .from(mediaVariantTable);
  return rows.length;
}
