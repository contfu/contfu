import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { Collection } from "./listCollections";

export interface CreateCollectionInput {
  name: string;
}

/**
 * Create a new Collection for a user.
 * This is the target that consumers subscribe to.
 */
export async function createCollection(
  userId: number,
  input: CreateCollectionInput,
): Promise<Collection> {
  const inserted = await db.transaction(async (tx) => {
    // Get next ID
    const maxIdResult = await tx
      .select({ maxId: sql<number>`coalesce(max(id), 0)` })
      .from(collectionTable)
      .where(eq(collectionTable.userId, userId))
      .limit(1);

    const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

    const [result] = await tx
      .insert(collectionTable)
      .values({
        userId,
        id: nextId,
        name: input.name,
      })
      .returning();

    return result;
  });

  return {
    id: inserted.id,
    userId: inserted.userId,
    name: inserted.name,
    sourceCollectionCount: 0,
    connectionCount: 0,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}
