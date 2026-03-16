import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export async function getSyncIndex(ctx = db): Promise<number | null> {
  const rows = await ctx.select().from(syncTable).limit(1).all();
  return rows[0]?.index ?? null;
}
