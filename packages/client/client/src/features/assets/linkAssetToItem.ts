import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemAssetTable } from "../../infra/db/schema";

export function linkAssetToItem(itemId: string, assetId: string, ctx = db): void {
  ctx
    .insert(itemAssetTable)
    .values({
      itemId: decodeId(itemId),
      assetId: decodeId(assetId),
    })
    .onConflictDoNothing()
    .run();
}
