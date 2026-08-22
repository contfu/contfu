import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export function setSyncIndex(index: number, ctx = db): void {
  ctx
    .insert(syncTable)
    .values({ key: 1, index })
    .onConflictDoUpdate({ target: syncTable.key, set: { index } })
    .run();
}
