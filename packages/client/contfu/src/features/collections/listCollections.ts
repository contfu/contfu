import { asc } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export type CollectionSummary = {
  name: string;
  ref: string;
  itemCount: number;
  createdAt: number;
  updatedAt?: number;
};

export async function listCollections(ctx = db): Promise<CollectionSummary[]> {
  const items = await ctx.select().from(itemsTable).orderBy(asc(itemsTable.collection)).all();
  const summaryByCollection = new Map<
    string,
    { itemCount: number; createdAt: number; updatedAt: number }
  >();

  for (const item of items) {
    const current = summaryByCollection.get(item.collection);
    if (!current) {
      summaryByCollection.set(item.collection, {
        itemCount: 1,
        createdAt: item.changedAt,
        updatedAt: item.changedAt,
      });
      continue;
    }

    summaryByCollection.set(item.collection, {
      itemCount: current.itemCount + 1,
      createdAt: Math.min(current.createdAt, item.changedAt),
      updatedAt: Math.max(current.updatedAt, item.changedAt),
    });
  }

  return [...summaryByCollection.entries()].map(([name, summary]) => ({
    name,
    ref: name,
    itemCount: summary.itemCount,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  }));
}
