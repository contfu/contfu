import type { ItemData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemToDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export async function updateItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): Promise<T> {
  await ctx
    .update(itemsTable)
    .set(await itemToDb(item, ctx))
    .where(eq(itemsTable.id, decodeId(item.id)));

  return item;
}
