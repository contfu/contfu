import type { ItemIdentity } from "@contfu/core";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { deleteItemLinksByRef } from "./deleteItemLinksByRef";

export function deleteItem(id: ItemIdentity, ctx = db): void {
  deleteItemLinksByRef(id, ctx);
  ctx.update(itemsTable).set({ deletedAt: Date.now() }).where(eq(itemsTable.identity, id)).run();
}
