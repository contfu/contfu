import type { ItemData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { itemToDb } from "../../infra/db/mappers";
import { itemsTable, type NewItem } from "../../infra/db/schema";

export async function createItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): Promise<T> {
  await ctx.insert(itemsTable).values((await itemToDb(item, ctx)) as NewItem);
  return item;
}
