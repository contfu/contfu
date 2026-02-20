import { asc } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { collectionTable, itemsTable } from "../../infra/db/schema";

export type CollectionSummary = {
  name: string;
  ref: string;
  itemCount: number;
  createdAt: number;
  updatedAt?: number;
};

export async function listCollections(ctx = db): Promise<CollectionSummary[]> {
  const [collections, items] = await Promise.all([
    ctx.select().from(collectionTable).orderBy(asc(collectionTable.name)).all(),
    ctx.select().from(itemsTable).all(),
  ]);

  const counts = new Map<number, number>();
  for (const item of items) {
    counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1);
  }

  return collections.map((collection) => ({
    name: collection.name,
    ref: collection.ref,
    itemCount: counts.get(collection.id) ?? 0,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt ?? undefined,
  }));
}
