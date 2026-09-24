import type { ItemData } from "../../infra/types/content-types";
import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemToDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export function updateItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): T {
  ctx
    .update(itemsTable)
    .set(itemToDb(item, ctx))
    .where(and(eq(itemsTable.id, item.id), eq(itemsTable.collection, item.collection)))
    .run();

  return item;
}
