import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { encodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";

export function getItemIdsByCollection(collection: string, ctx = db): string[] {
  const dbos = ctx.select().from(itemsTable).where(eq(itemsTable.collection, collection)).all();

  return dbos.map((dbo) => encodeId(dbo.id));
}
