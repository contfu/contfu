import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";

export async function getCollectionId(name: string, ctx = db): Promise<number | null> {
  const result = await ctx
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.name, name))
    .limit(1)
    .all();

  return result.length > 0 ? result[0].id : null;
}
