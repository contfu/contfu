import type { ItemIdentity } from "@contfu/core";
import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { externalLinkTable, internalLinkTable } from "../../infra/db/schema";

export function deleteOutgoingItemLinks(from: ItemIdentity, ctx = db): void {
  ctx.delete(internalLinkTable).where(eq(internalLinkTable.from, from)).run();
  ctx.delete(externalLinkTable).where(eq(externalLinkTable.from, from)).run();
}
