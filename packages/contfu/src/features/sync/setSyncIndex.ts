import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export function setSyncIndex(index: number, ctx = db): void {
  const existing = ctx.select().from(syncTable).limit(1).all();

  if (existing.length > 0) {
    ctx.update(syncTable).set({ index }).run();
    return;
  }

  ctx.insert(syncTable).values({ index }).run();
}
