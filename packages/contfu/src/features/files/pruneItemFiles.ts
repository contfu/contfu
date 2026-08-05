import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { fileTable, itemFileTable } from "../../infra/db/schema";

/**
 * Drop the links to files the item no longer references, and delete the files
 * that end up without any link. Item content is replaced wholesale on every
 * ITEM_CHANGED, so a file that is missing from `keepFileIds` was removed
 * upstream — without this the old and the new file would both render.
 */
export function pruneItemFiles(itemId: number, keepFileIds: Iterable<string>, ctx = db): void {
  const keep = [...new Set(keepFileIds)].map(decodeId);

  const stale = ctx
    .select({ fileId: itemFileTable.fileId })
    .from(itemFileTable)
    .where(
      keep.length === 0
        ? eq(itemFileTable.itemId, itemId)
        : and(eq(itemFileTable.itemId, itemId), notInArray(itemFileTable.fileId, keep)),
    )
    .all();

  if (stale.length === 0) return;

  for (const { fileId } of stale) {
    ctx
      .delete(itemFileTable)
      .where(and(eq(itemFileTable.itemId, itemId), eq(itemFileTable.fileId, fileId)))
      .run();

    const remaining = ctx
      .select({ count: sql<number>`count(*)` })
      .from(itemFileTable)
      .where(eq(itemFileTable.fileId, fileId))
      .get();

    // Media masters and variants are removed by their cascading foreign keys.
    if (!remaining || remaining.count === 0) {
      ctx.delete(fileTable).where(eq(fileTable.id, fileId)).run();
    }
  }
}
