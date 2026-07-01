import { and, inArray, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";
import type { ItemData } from "../../infra/types/content-types";

export function getItemsByIds({ ids }: { ids: number[] }, ctx = db): ItemData[] {
  const dbos = ctx
    .select()
    .from(itemsTable)
    .where(and(inArray(itemsTable.id, ids), isNull(itemsTable.deletedAt)))
    .all();

  return dbos.map((dbo) => itemFromDb(dbo, ctx));
}
