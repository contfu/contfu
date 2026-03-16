import { eq, or } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export async function deleteItemLinksByRef(id: string, ctx = db): Promise<void> {
  const idBlob = decodeId(id);
  await ctx.delete(linkTable).where(or(eq(linkTable.from, idBlob), eq(linkTable.to, idBlob)));
}
