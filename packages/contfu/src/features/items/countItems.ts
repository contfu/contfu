import { count } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export function countItems(ctx = db) {
  const { value } = ctx.select({ value: count() }).from(itemsTable).get()!;
  return value;
}
