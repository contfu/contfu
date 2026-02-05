import { db } from "../../infra/db/db";
import { sourceCollectionTable, type SourceCollection } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";

export interface CreateSourceCollectionInput {
  sourceId: number;
  name: string;
  ref?: Buffer | null;
  displayName?: string | null;
  schema?: Buffer | null;
}

/**
 * Create a new SourceCollection without auto-creating a Collection or Influx.
 * Use this when you want to create a SourceCollection and link it to an
 * existing Collection via an Influx yourself.
 */
export async function createSourceCollection(
  userId: number,
  input: CreateSourceCollectionInput,
): Promise<SourceCollection> {
  const inserted = await db.transaction(async (tx) => {
    // Get next ID for source collection
    const maxIdResult = await tx
      .select({ maxId: sql<number>`coalesce(max(id), 0)` })
      .from(sourceCollectionTable)
      .where(eq(sourceCollectionTable.userId, userId))
      .limit(1);

    const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

    // Create the source collection
    const [sourceCollection] = await tx
      .insert(sourceCollectionTable)
      .values({
        userId,
        id: nextId,
        sourceId: input.sourceId,
        name: input.name,
        displayName: input.displayName ?? null,
        ref: input.ref ?? null,
        schema: input.schema ?? null,
      })
      .returning();

    return sourceCollection;
  });

  return inserted;
}
