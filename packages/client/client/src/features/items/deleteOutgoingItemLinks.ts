import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export function deleteOutgoingItemLinks(from: string, ctx = db): void {
  ctx
    .delete(linkTable)
    .where(eq(linkTable.from, decodeId(from)))
    .run();
}
