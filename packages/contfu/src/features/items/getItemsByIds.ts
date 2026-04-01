import { inArray } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";
import { decodeId } from "../../infra/ids";
import type { ItemData } from "../../infra/types/content-types";

export function getItemsByIds({ ids }: { ids: string[] }, ctx = db): ItemData[] {
  const dbos = ctx
    .select()
    .from(itemsTable)
    .where(
      inArray(
        itemsTable.id,
        ids.map((id) => decodeId(id)),
      ),
    )
    .all();

  return dbos.map((dbo) => itemFromDb(dbo, ctx));
}
