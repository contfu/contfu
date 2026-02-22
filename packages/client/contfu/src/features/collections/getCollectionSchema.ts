import type { CollectionSchema } from "@contfu/core";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionSchemaTable } from "../../infra/db/schema";

export async function getCollectionSchema(collection: string): Promise<CollectionSchema | null> {
  const rows = await db
    .select({ schema: collectionSchemaTable.schema })
    .from(collectionSchemaTable)
    .where(eq(collectionSchemaTable.collection, collection));
  return rows.length > 0 ? rows[0].schema : null;
}
