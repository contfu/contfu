import { eq, or } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export function deleteItemLinksByRef(id: string, ctx = db): void {
  const idBlob = decodeId(id);
  ctx
    .delete(linkTable)
    .where(or(eq(linkTable.from, idBlob), eq(linkTable.to, idBlob)))
    .run();
}
