import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";

export function getSyncIndex(ctx = db): number | null {
  const rows = ctx.select().from(syncTable).limit(1).all();
  return rows[0]?.index ?? null;
}
