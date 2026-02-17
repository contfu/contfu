import { db } from "../../infra/db/db";
import { sourceCollectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { decode } from "@msgpack/msgpack";
import type { CollectionSchema } from "@contfu/svc-core";

/**
 * Get the schema for a source collection.
 * Returns null if the collection doesn't exist or has no schema.
 */
export async function getCollectionSchema(
  userId: number,
  id: number,
): Promise<CollectionSchema | null> {
  const [collection] = await db
    .select({ schema: sourceCollectionTable.schema })
    .from(sourceCollectionTable)
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .limit(1);

  if (!collection?.schema) return null;

  try {
    return decode(collection.schema) as CollectionSchema;
  } catch {
    return null;
  }
}
