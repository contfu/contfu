import type { CollectionSchema } from "@contfu/core";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function getCollectionSchemaByName(name: string, ctx = db): CollectionSchema | null {
  const row = ctx
    .select({ schema: collectionsTable.schema })
    .from(collectionsTable)
    .where(eq(collectionsTable.name, name))
    .get();
  return row?.schema ?? null;
}
