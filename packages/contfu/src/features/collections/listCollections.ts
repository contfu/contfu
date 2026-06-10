import { asc, count, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionsTable, itemsTable } from "../../infra/db/schema";

import type { EffectiveCollectionI18nConfig } from "@contfu/core";

export type CollectionSummary = {
  name: string;
  displayName: string;
  ref: string;
  itemCount: number;
  i18n?: EffectiveCollectionI18nConfig | null;
};

export function listCollections(ctx = db): CollectionSummary[] {
  const rows = ctx
    .select({
      name: collectionsTable.name,
      displayName: collectionsTable.displayName,
      i18n: collectionsTable.i18n,
      itemCount: count(itemsTable.id),
    })
    .from(collectionsTable)
    .leftJoin(itemsTable, eq(itemsTable.collection, collectionsTable.name))
    .groupBy(collectionsTable.name)
    .orderBy(asc(collectionsTable.name))
    .all();

  return rows.map((row) => ({
    name: row.name,
    displayName: row.displayName,
    ref: row.name,
    itemCount: row.itemCount,
    i18n: row.i18n,
  }));
}
