import { count, eq } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import { db } from "../../infra/db/db";
import { fileTable, mediaVariantTable } from "../../infra/db/schema";

export function countFiles(ctx = db) {
  const { value } = ctx.select({ value: count() }).from(fileTable).get()!;
  return value;
}

export function countDownloadedFiles(ctx = db) {
  const row = ctx
    .select({ value: count() })
    .from(fileTable)
    .where(eq(fileTable.status, FileStatus.Ready))
    .get();
  return row?.value ?? 0;
}

export function countProcessedFiles(ctx = db) {
  const rows = ctx
    .selectDistinct({ fileId: mediaVariantTable.fileId })
    .from(mediaVariantTable)
    .all();
  return rows.length;
}
