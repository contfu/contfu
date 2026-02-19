import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

export interface UpdateCollectionInput {
  name?: string;
  includeRef?: boolean;
}

/**
 * Update a Collection.
 */
export async function updateCollection(
  userId: number,
  collectionId: number,
  input: UpdateCollectionInput,
): Promise<boolean> {
  const result = await db
    .update(collectionTable)
    .set({
      name: input.name,
      includeRef: input.includeRef,
      updatedAt: new Date(),
    })
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
    .returning();

  return result.length > 0;
}
