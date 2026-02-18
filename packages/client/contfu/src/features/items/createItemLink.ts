import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export async function createItemLink(
  { type, from, to }: { type: string; from: string; to: string },
  ctx = db,
): Promise<void> {
  await ctx.insert(linkTable).values({
    type,
    from: decodeId(from),
    to: decodeId(to),
  });
}
