import { eq, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable } from "../../infra/db/schema";

export function deleteFilesByItem(itemId: number, ctx = db): void {
  // Get file IDs linked to this item before removing the links
  const linkedFiles = ctx
    .select({ fileId: itemFileTable.fileId })
    .from(itemFileTable)
    .where(eq(itemFileTable.itemId, itemId))
    .all();

  // Remove junction rows for this item
  ctx.delete(itemFileTable).where(eq(itemFileTable.itemId, itemId)).run();

  // Delete orphan files (no remaining links in itemFileTable)
  for (const { fileId } of linkedFiles) {
    const remaining = ctx
      .select({ count: sql<number>`count(*)` })
      .from(itemFileTable)
      .where(eq(itemFileTable.fileId, fileId))
      .all();

    if (remaining[0].count === 0) {
      ctx.delete(fileTable).where(eq(fileTable.id, fileId)).run();
    }
  }
}
