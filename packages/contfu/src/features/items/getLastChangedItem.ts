import type { ItemData } from "../../infra/types/content-types";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export function getLastChangedItem(collection: string, ctx = db): Omit<ItemData, "links"> | null {
  const dbo = ctx
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.collection, collection), isNull(itemsTable.deletedAt)))
    .orderBy(desc(itemsTable.changedAt))
    .limit(1)
    .all();

  return dbo.length > 0 ? itemFromDb(dbo[0], ctx) : null;
}
