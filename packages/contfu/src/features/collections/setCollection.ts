import type { CollectionSchema, EffectiveCollectionI18nConfig } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function setCollection(
  name: string,
  displayName: string,
  schema: CollectionSchema,
  i18n: EffectiveCollectionI18nConfig | undefined = undefined,
  ctx = db,
): void {
  ctx
    .insert(collectionsTable)
    .values({ name, displayName, schema, i18n: i18n ?? null })
    .onConflictDoUpdate({
      target: collectionsTable.name,
      set: { displayName, schema, i18n: i18n ?? null },
    })
    .run();
}
