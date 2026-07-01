import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { deleteItemLinksByRef } from "./deleteItemLinksByRef";

export function deleteItem(id: number, ctx = db): void {
  deleteItemLinksByRef(id, ctx);
  ctx.update(itemsTable).set({ deletedAt: Date.now() }).where(eq(itemsTable.id, id)).run();
}
