import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export function createItemLink(
  {
    prop,
    from,
    to,
    internal,
  }: { prop: string | null; from: string; to: string; internal: boolean },
  ctx = db,
): number {
  const result = ctx
    .insert(linkTable)
    .values({
      prop,
      from: decodeId(from),
      to: decodeId(to),
      internal,
    })
    .returning({ id: linkTable.id })
    .get();

  return result.id;
}
