import type { ItemData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemToDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export function updateItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): T {
  ctx
    .update(itemsTable)
    .set(itemToDb(item, ctx))
    .where(eq(itemsTable.id, decodeId(item.id)))
    .run();

  return item;
}
