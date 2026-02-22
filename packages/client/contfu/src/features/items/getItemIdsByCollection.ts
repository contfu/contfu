import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { encodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";

export async function getItemIdsByCollection(collection: string, ctx = db): Promise<string[]> {
  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collection))
    .all();

  return dbos.map((dbo) => encodeId(dbo.id));
}
