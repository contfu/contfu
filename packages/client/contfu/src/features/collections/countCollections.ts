import { countDistinct } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export function countCollections() {
  const { count } = db
    .select({ count: countDistinct(itemsTable.collection) })
    .from(itemsTable)
    .get()!;
  return count;
}
