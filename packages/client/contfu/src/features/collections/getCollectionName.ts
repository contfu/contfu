import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";

export async function getCollectionName(id: number, ctx = db): Promise<string | null> {
  const result = await ctx
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.id, id))
    .limit(1)
    .all();

  return result.length > 0 ? result[0].name : null;
}
