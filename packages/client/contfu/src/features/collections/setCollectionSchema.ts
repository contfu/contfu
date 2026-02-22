import type { CollectionSchema } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionSchemaTable } from "../../infra/db/schema";

export async function setCollectionSchema(
  collection: string,
  schema: CollectionSchema,
): Promise<void> {
  await db.insert(collectionSchemaTable).values({ collection, schema }).onConflictDoUpdate({
    target: collectionSchemaTable.collection,
    set: { schema },
  });
}
