import type { FileData } from "../../infra/types/content-types";
import { eq, isNull } from "drizzle-orm";
import { fileFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable } from "../../infra/db/schema";

export function getOrphanFiles(ctx = db): FileData[] {
  const rows = ctx
    .select({ file: fileTable })
    .from(fileTable)
    .leftJoin(itemFileTable, eq(fileTable.id, itemFileTable.fileId))
    .where(isNull(itemFileTable.itemId))
    .all();

  return rows.map((row) => fileFromDb(row.file));
}
