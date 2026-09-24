import type { ItemData } from "../../infra/types/content-types";
import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { createItem } from "./createItem";
import { updateItem } from "./updateItem";

export function createOrUpdateItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): T {
  const existing = ctx
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.id, item.id), eq(itemsTable.collection, item.collection)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    updateItem(item, ctx);
    return item;
  }

  return createItem(item, ctx);
}
