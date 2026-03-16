import { inArray } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable } from "../../infra/db/schema";

export async function deleteAssets(ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  await ctx.delete(assetTable).where(
    inArray(
      assetTable.id,
      ids.map((id) => decodeId(id)),
    ),
  );
}
