import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";

export async function deleteItem(id: string, ctx = db): Promise<void> {
  await ctx.delete(itemsTable).where(eq(itemsTable.id, decodeId(id)));
}
