import { count } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

// TODO: db.$count is async even for sync SQLite drivers (Drizzle bug). Report upstream.
export function countCollections(ctx = db) {
  const { value } = ctx.select({ value: count() }).from(collectionsTable).get()!;
  return value;
}
