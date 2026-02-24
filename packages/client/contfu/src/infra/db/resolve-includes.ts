import { eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "./db";
import { assetTable, itemAssetTable, linkTable } from "./schema";
import { assetFromDb } from "./mappers";
import { decodeId, encodeId } from "../ids";
import type { AssetData } from "../types/content-types";
import type { IncludeOption, ItemWithRelations } from "../../domain/query-types";

export function resolveIncludes(
  items: ItemWithRelations[],
  include: IncludeOption[],
  ctx = defaultDb,
): void {
  if (items.length === 0 || include.length === 0) return;

  const ids = items.map((i) => decodeId(i.id));

  if (include.includes("assets")) {
    const rows = ctx
      .select({ itemId: itemAssetTable.itemId, asset: assetTable })
      .from(itemAssetTable)
      .innerJoin(assetTable, eq(itemAssetTable.assetId, assetTable.id))
      .where(inArray(itemAssetTable.itemId, ids))
      .all();

    const assetsByItem = new Map<string, AssetData[]>();
    for (const row of rows) {
      const itemId = encodeId(row.itemId);
      if (!assetsByItem.has(itemId)) assetsByItem.set(itemId, []);
      assetsByItem.get(itemId)!.push(assetFromDb(row.asset));
    }

    for (const item of items) {
      item.assets = assetsByItem.get(item.id) ?? [];
    }
  }

  if (include.includes("links")) {
    const rows = ctx.select().from(linkTable).where(inArray(linkTable.from, ids)).all();

    const linksByItem = new Map<string, Record<string, string[]>>();
    for (const row of rows) {
      const fromId = encodeId(row.from);
      if (!linksByItem.has(fromId)) linksByItem.set(fromId, {});
      const itemLinks = linksByItem.get(fromId)!;
      if (!itemLinks[row.type]) itemLinks[row.type] = [];
      itemLinks[row.type].push(encodeId(row.to));
    }

    for (const item of items) {
      const resolved = linksByItem.get(item.id) ?? {};
      item.links = { content: [], ...item.links, ...resolved };
    }
  }
}
