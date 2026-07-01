import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export function getItemIdsByCollection(collection: string, ctx = db): number[] {
  const dbos = ctx
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.collection, collection), isNull(itemsTable.deletedAt)))
    .all();

  return dbos.map((dbo) => dbo.id);
}
