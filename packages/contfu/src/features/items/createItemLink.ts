import { db } from "../../infra/db/db";
import { internalLinkTable } from "../../infra/db/schema";

export function createItemLink(
  { prop, from, to }: { prop: string | null; from: number; to: number },
  ctx = db,
): number {
  const result = ctx
    .insert(internalLinkTable)
    .values({ prop, from, to })
    .returning({ id: internalLinkTable.id })
    .get();

  return result.id;
}
