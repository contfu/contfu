import { eq, sql } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { quotaTable } from "../../infra/db/schema";
import { publishCountDelta } from "../../infra/cache/quota-cache";

export async function addItemsCount(userId: number, itemCount: number): Promise<void> {
  await db
    .update(quotaTable)
    .set({ items: sql`${quotaTable.items} + ${itemCount}` })
    .where(eq(quotaTable.id, userId));
  publishCountDelta(userId, { items: itemCount });
}
