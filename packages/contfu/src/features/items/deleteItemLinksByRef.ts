import { eq, or } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { internalLinkTable } from "../../infra/db/schema";

export function deleteItemLinksByRef(id: number, ctx = db): void {
  ctx
    .delete(internalLinkTable)
    .where(or(eq(internalLinkTable.from, id), eq(internalLinkTable.to, id)))
    .run();
}
