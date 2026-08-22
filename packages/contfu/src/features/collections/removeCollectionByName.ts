import { eq, or, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import {
  collectionsTable,
  fileTable,
  internalLinkTable,
  itemFileTable,
  itemsTable,
} from "../../infra/db/schema";

export function removeCollectionByName(name: string, ctx = db): void {
  ctx.transaction((tx) => {
    const itemIds = tx
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(eq(itemsTable.collection, name))
      .all()
      .map(({ id }) => id);

    for (const itemId of itemIds) {
      const linkedFiles = tx
        .select({ fileId: itemFileTable.fileId })
        .from(itemFileTable)
        .where(eq(itemFileTable.itemId, itemId))
        .all();

      tx.delete(itemFileTable).where(eq(itemFileTable.itemId, itemId)).run();
      for (const { fileId } of linkedFiles) {
        const remaining = tx
          .select({ count: sql<number>`count(*)` })
          .from(itemFileTable)
          .where(eq(itemFileTable.fileId, fileId))
          .all();
        if (remaining[0].count === 0) {
          tx.delete(fileTable).where(eq(fileTable.id, fileId)).run();
        }
      }

      tx.delete(internalLinkTable)
        .where(or(eq(internalLinkTable.from, itemId), eq(internalLinkTable.to, itemId)))
        .run();
      tx.delete(itemsTable).where(eq(itemsTable.id, itemId)).run();
    }
    tx.delete(collectionsTable).where(eq(collectionsTable.name, name)).run();
  });
}
