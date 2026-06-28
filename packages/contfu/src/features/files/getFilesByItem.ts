import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { fileMetadataFromDb } from "../../infra/db/mappers";
import { fileTable, itemFileTable } from "../../infra/db/schema";
import type { FileData } from "../../infra/types/content-types";

export function getFilesByItem(itemId: number, ctx = db): FileData[] {
  const rows = ctx
    .select({
      file: {
        id: fileTable.id,
        status: fileTable.status,
        mediaType: fileTable.mediaType,
        meta: fileTable.meta,
        createdAt: fileTable.createdAt,
      },
    })
    .from(itemFileTable)
    .innerJoin(fileTable, eq(itemFileTable.fileId, fileTable.id))
    .where(eq(itemFileTable.itemId, itemId))
    .all();

  return rows.map((row) => fileMetadataFromDb({ ...row.file, data: null }));
}
