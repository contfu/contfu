import type { ItemData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export async function getItems(ctx = db): Promise<ItemData[]> {
  const dbos = await ctx.select().from(itemsTable).all();
  return Promise.all(dbos.map((dbo) => itemFromDb(dbo, ctx)));
}
