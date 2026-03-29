import type { CollectionSchema } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function setCollection(
  name: string,
  displayName: string,
  schema: CollectionSchema,
  ctx = db,
): void {
  ctx
    .insert(collectionsTable)
    .values({ name, displayName, schema })
    .onConflictDoUpdate({
      target: collectionsTable.name,
      set: { displayName, schema },
    })
    .run();
}
