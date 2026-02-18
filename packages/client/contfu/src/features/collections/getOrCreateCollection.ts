import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";

export async function getOrCreateCollection(name: string, ctx = db): Promise<number> {
  const existing = await ctx
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.name, name))
    .limit(1)
    .all();

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [{ id }] = await ctx
    .insert(collectionTable)
    .values({ ref: name, name, createdAt: Date.now() })
    .returning();

  return id;
}
