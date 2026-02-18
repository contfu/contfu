import type { ItemData } from "../../infra/types/content-types";
import { desc, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";
import { getCollectionId } from "../collections/getCollectionId";

export async function getLastChangedItem(
  collection: string,
  ctx = db,
): Promise<Omit<ItemData, "links"> | null> {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return null;

  const dbo = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .orderBy(desc(itemsTable.changedAt))
    .limit(1)
    .all();

  return dbo.length > 0 ? itemFromDb(dbo[0], ctx) : null;
}
