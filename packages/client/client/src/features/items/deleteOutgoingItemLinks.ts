import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export async function deleteOutgoingItemLinks(from: string, ctx = db): Promise<void> {
  await ctx.delete(linkTable).where(eq(linkTable.from, decodeId(from)));
}
