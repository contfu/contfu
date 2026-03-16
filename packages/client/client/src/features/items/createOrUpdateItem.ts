import type { ItemData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";
import { createItem } from "./createItem";
import { updateItem } from "./updateItem";

export async function createOrUpdateItem<T extends Omit<ItemData, "links">>(
  item: T,
  ctx = db,
): Promise<T> {
  const existing = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, decodeId(item.id)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    await updateItem(item, ctx);
    return item;
  }

  return createItem(item, ctx);
}
