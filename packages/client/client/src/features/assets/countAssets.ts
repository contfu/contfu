import { isNotNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { assetTable, mediaVariantTable } from "../../infra/db/schema";

export function countAssets() {
  return db.$count(assetTable);
}

export function countDownloadedAssets() {
  return db.$count(assetTable, isNotNull(assetTable.data));
}

export function countProcessedAssets() {
  const rows = db
    .selectDistinct({ assetId: mediaVariantTable.assetId })
    .from(mediaVariantTable)
    .all();
  return rows.length;
}
