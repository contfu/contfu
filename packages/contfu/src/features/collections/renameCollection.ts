import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable, itemsTable } from "../../infra/db/schema";

export function renameCollection(
  oldName: string,
  newName: string,
  newDisplayName: string,
  ctx = db,
): void {
  ctx.transaction((tx) => {
    tx.update(collectionsTable)
      .set({ name: newName, displayName: newDisplayName })
      .where(eq(collectionsTable.name, oldName))
      .run();
    tx.update(itemsTable)
      .set({ collection: newName })
      .where(eq(itemsTable.collection, oldName))
      .run();
  });
}
