import { isNotNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { fileTable, mediaVariantTable } from "../../infra/db/schema";

export function countFiles() {
  return db.$count(fileTable);
}

export function countDownloadedFiles() {
  return db.$count(fileTable, isNotNull(fileTable.data));
}

export function countProcessedFiles() {
  const rows = db
    .selectDistinct({ fileId: mediaVariantTable.fileId })
    .from(mediaVariantTable)
    .all();
  return rows.length;
}
