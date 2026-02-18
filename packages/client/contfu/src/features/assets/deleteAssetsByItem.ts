import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable } from "../../infra/db/schema";

export async function deleteAssetsByItem(itemId: string, ctx = db): Promise<void> {
  await ctx.delete(assetTable).where(eq(assetTable.itemId, decodeId(itemId)));
}
