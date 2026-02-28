import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemsTable } from "../../infra/db/schema";
import { deleteItemLinksByRef } from "./deleteItemLinksByRef";

export async function deleteItemsByIds(ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  for (const id of ids) {
    await deleteItemLinksByRef(id, ctx);
    await ctx.delete(itemsTable).where(eq(itemsTable.id, decodeId(id)));
  }
}
