import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { linkTable, type DbItemLink } from "../../infra/db/schema";

export function getItemLinks(
  opts: Partial<{ prop: string | null; from: string; to: string; internal: boolean }>,
  ctx = db,
): DbItemLink[] {
  return ctx
    .select()
    .from(linkTable)
    .where(
      and(
        opts.prop !== undefined
          ? opts.prop === null
            ? isNull(linkTable.prop)
            : eq(linkTable.prop, opts.prop)
          : undefined,
        opts.from ? eq(linkTable.from, decodeId(opts.from)) : undefined,
        opts.to ? eq(linkTable.to, decodeId(opts.to)) : undefined,
        opts.internal !== undefined ? eq(linkTable.internal, opts.internal) : undefined,
      ),
    )
    .all();
}
