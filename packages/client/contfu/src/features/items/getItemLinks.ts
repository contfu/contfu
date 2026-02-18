import type { ItemLinks } from "../../infra/types/content-types";
import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId, encodeId } from "../../infra/ids";
import { linkTable } from "../../infra/db/schema";

export async function getItemLinks(
  opts: Partial<{ type: string; from: string; to: string }>,
  ctx = db,
): Promise<ItemLinks> {
  const dbos = await ctx
    .select()
    .from(linkTable)
    .where(
      and(
        opts.type ? eq(linkTable.type, opts.type) : undefined,
        opts.from ? eq(linkTable.from, decodeId(opts.from)) : undefined,
        opts.to ? eq(linkTable.to, decodeId(opts.to)) : undefined,
      ),
    )
    .all();

  const links = { content: [] } as ItemLinks;
  for (const { type, from, to } of dbos) {
    if (!links[type]) links[type] = [];
    links[type].push(encodeId("to" in opts ? from : to));
  }

  return links;
}
