import { count, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export function countItems(ctx = db) {
  const { value } = ctx
    .select({ value: count() })
    .from(itemsTable)
    .where(isNull(itemsTable.deletedAt))
    .get()!;
  return value;
}
