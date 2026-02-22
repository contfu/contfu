import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export async function setSyncIndex(index: number, ctx = db): Promise<void> {
  const existing = await ctx.select().from(syncTable).limit(1).all();

  if (existing.length > 0) {
    await ctx.update(syncTable).set({ index }).run();
    return;
  }

  await ctx.insert(syncTable).values({ index }).run();
}
