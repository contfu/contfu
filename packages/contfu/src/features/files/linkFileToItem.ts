import type { ItemIdentity } from "@contfu/core";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemFileTable } from "../../infra/db/schema";

export function linkFileToItem(itemId: ItemIdentity, fileId: string, ctx = db): void {
  ctx
    .insert(itemFileTable)
    .values({
      itemId,
      fileId: decodeId(fileId),
    })
    .onConflictDoNothing()
    .run();
}
