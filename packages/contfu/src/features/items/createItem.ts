import type { ItemData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { itemToDb } from "../../infra/db/mappers";
import { itemsTable, type NewItem } from "../../infra/db/schema";

export function createItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): T {
  ctx
    .insert(itemsTable)
    .values(itemToDb(item, ctx) as NewItem)
    .run();
  return item;
}
