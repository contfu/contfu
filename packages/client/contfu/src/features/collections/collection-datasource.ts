import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { collectionTable } from "../../db/schema";

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
    .values({ name, createdAt: Date.now() })
    .returning();
  return id;
}

export async function getCollectionId(name: string, ctx = db): Promise<number | null> {
  const result = await ctx
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.name, name))
    .limit(1)
    .all();
  return result.length > 0 ? result[0].id : null;
}

export async function getCollectionName(id: number, ctx = db): Promise<string | null> {
  const result = await ctx
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.id, id))
    .limit(1)
    .all();
  return result.length > 0 ? result[0].name : null;
}
