import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { deleteItemLinksByRef } from "./deleteItemLinksByRef";

export function deleteItemsByIds(ids: number[], ctx = db): void {
  if (ids.length === 0) return;

  for (const id of ids) {
    deleteItemLinksByRef(id, ctx);
    ctx.delete(itemsTable).where(eq(itemsTable.id, id)).run();
  }
}
