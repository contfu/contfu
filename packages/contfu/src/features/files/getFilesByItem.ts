import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { fileFromDb } from "../../infra/db/mappers";
import { fileTable, itemFileTable } from "../../infra/db/schema";
import { decodeId } from "../../infra/ids";
import type { FileData } from "../../infra/types/content-types";

export function getFilesByItem(itemId: string, ctx = db): FileData[] {
  const rows = ctx
    .select({ file: fileTable })
    .from(itemFileTable)
    .innerJoin(fileTable, eq(itemFileTable.fileId, fileTable.id))
    .where(eq(itemFileTable.itemId, decodeId(itemId)))
    .all();

  return rows.map((row) => fileFromDb(row.file));
}
