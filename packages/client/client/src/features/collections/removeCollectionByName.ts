import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable, itemsTable } from "../../infra/db/schema";

export function removeCollectionByName(name: string, ctx = db): void {
  ctx.delete(itemsTable).where(eq(itemsTable.collection, name)).run();
  ctx.delete(collectionsTable).where(eq(collectionsTable.name, name)).run();
}
