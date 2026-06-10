import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { internalLinkTable, type DbInternalItemLink } from "../../infra/db/schema";

export function getItemLinks(
  opts: Partial<{ prop: string | null; from: number; to: number }>,
  ctx = db,
): DbInternalItemLink[] {
  return ctx
    .select()
    .from(internalLinkTable)
    .where(
      and(
        opts.prop !== undefined
          ? opts.prop === null
            ? isNull(internalLinkTable.prop)
            : eq(internalLinkTable.prop, opts.prop)
          : undefined,
        opts.from ? eq(internalLinkTable.from, opts.from) : undefined,
        opts.to ? eq(internalLinkTable.to, opts.to) : undefined,
      ),
    )
    .all();
}
