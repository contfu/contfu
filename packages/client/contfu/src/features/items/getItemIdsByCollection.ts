import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { encodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";
import { getCollectionId } from "../collections/getCollectionId";

export async function getItemIdsByCollection(collection: string, ctx = db): Promise<string[]> {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return [];

  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .all();

  return dbos.map((dbo) => encodeId(dbo.id));
}
