import type { CollectionSchema } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionSchemaTable } from "../../infra/db/schema";

export async function getAllCollectionSchemas(): Promise<Record<string, CollectionSchema>> {
  const rows = await db.select().from(collectionSchemaTable);
  return Object.fromEntries(rows.map((r) => [r.collection, r.schema]));
}
