import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { itemFileTable } from "../../infra/db/schema";

export function linkFileToItem(itemId: number, fileId: string, ctx = db): void {
  ctx
    .insert(itemFileTable)
    .values({
      itemId,
      fileId: decodeId(fileId),
    })
    .onConflictDoNothing()
    .run();
}
