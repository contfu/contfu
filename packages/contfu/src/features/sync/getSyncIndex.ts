import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export function getSyncIndex(ctx = db): number | null {
  const row = ctx.select().from(syncTable).where(eq(syncTable.key, 1)).get();
  return row?.index ?? null;
}
