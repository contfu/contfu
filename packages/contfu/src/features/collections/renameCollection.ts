import { eq, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable, itemsTable, internalLinkTable } from "../../infra/db/schema";

export function renameCollection(
  oldName: string,
  newName: string,
  newDisplayName: string,
  ctx = db,
): void {
  ctx.transaction((tx) => {
    // Incoming links may be dangling, so they intentionally have no target FK.
    // Rewrite their collection dimension explicitly when the collection is renamed.
    tx.update(internalLinkTable)
      .set({
        to: sql`json_array(${newName}, json_extract(${internalLinkTable.to}, '$[1]'))`,
      })
      .where(sql`json_extract(${internalLinkTable.to}, '$[0]') = ${oldName}`)
      .run();
    for (const collection of tx.select().from(collectionsTable).all()) {
      if (!collection.refTargets) continue;
      const refTargets = Object.fromEntries(
        Object.entries(collection.refTargets).map(([property, targets]) => [
          property,
          targets.map((target) => (target === oldName ? newName : target)),
        ]),
      );
      tx.update(collectionsTable)
        .set({ refTargets })
        .where(eq(collectionsTable.name, collection.name))
        .run();
    }
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
