import type { CollectionSchema } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function getAllCollectionSchemas(ctx = db): Record<string, CollectionSchema> {
  const rows = ctx.select().from(collectionsTable).all();
  return Object.fromEntries(rows.map((r) => [r.name, r.schema]));
}
