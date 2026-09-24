import type { RefTargets, CollectionSchema, EffectiveCollectionI18nConfig } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function setCollection(
  name: string,
  displayName: string,
  schema: CollectionSchema,
  i18n: EffectiveCollectionI18nConfig | undefined = undefined,
  ctx = db,
  refTargets?: RefTargets,
): void {
  const updates: {
    displayName: string;
    schema: CollectionSchema;
    i18n: EffectiveCollectionI18nConfig | null;
    refTargets?: RefTargets;
  } = { displayName, schema, i18n: i18n ?? null };
  if (refTargets !== undefined) updates.refTargets = refTargets;

  ctx
    .insert(collectionsTable)
    .values({ name, displayName, schema, refTargets: refTargets ?? {}, i18n: i18n ?? null })
    .onConflictDoUpdate({
      target: collectionsTable.name,
      set: updates,
    })
    .run();
}
