import type { ItemData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export function getItem({ id }: { id: string }, ctx = db): Omit<ItemData, "links"> | null {
  const dbos = ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, decodeId(id)))
    .all();

  return dbos.length > 0 ? itemFromDb(dbos[0], ctx) : null;
}
