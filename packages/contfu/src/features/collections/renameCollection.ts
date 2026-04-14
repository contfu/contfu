import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function renameCollection(
  oldName: string,
  newName: string,
  newDisplayName: string,
  ctx = db,
): void {
  ctx
    .update(collectionsTable)
    .set({ name: newName, displayName: newDisplayName })
    .where(eq(collectionsTable.name, oldName))
    .run();
}
