import { and, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb } from "./db";
import { assetTable, itemAssetTable, itemsTable, linkTable } from "./schema";
import { assetFromDb } from "./mappers";
import { decodeId, encodeId } from "../ids";
import type { AssetData, ResolvedLink } from "../types/content-types";
import type { IncludeOption } from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";

export function resolveIncludes(
  items: ItemWithRelations[],
  include: IncludeOption[],
  ctx = defaultDb,
): void {
  if (items.length === 0 || include.length === 0) return;

  const ids = items.map((i) => decodeId(i.$id));

  if (include.includes("assets")) {
    const rows = ctx
      .select({ itemId: itemAssetTable.itemId, asset: assetTable })
      .from(itemAssetTable)
      .innerJoin(assetTable, eq(itemAssetTable.assetId, assetTable.id))
      .where(inArray(itemAssetTable.itemId, ids))
      .all();

    const assetsByItem = new Map<string, AssetData[]>();
    for (const row of rows) {
      const itemId = encodeId(Buffer.from(row.itemId));
      if (!assetsByItem.has(itemId)) assetsByItem.set(itemId, []);
      assetsByItem.get(itemId)!.push(assetFromDb(row.asset));
    }

    for (const item of items) {
      item.assets = assetsByItem.get(item.$id) ?? [];
    }
  }

  if (include.includes("links")) {
    // Only content-derived links (prop IS NULL)
    const rows = ctx
      .select()
      .from(linkTable)
      .where(and(inArray(linkTable.from, ids), isNull(linkTable.prop)))
      .all();

    // Collect internal target IDs for batch fetch
    const internalTargetIds = new Set<string>();
    for (const row of rows) {
      if (row.internal) {
        internalTargetIds.add(encodeId(row.to));
      }
    }

    // Batch-fetch internal target items
    const targetItemMap = new Map<string, Record<string, unknown>>();
    if (internalTargetIds.size > 0) {
      const targetBufs = [...internalTargetIds].map(decodeId);
      const targetRows = ctx
        .select()
        .from(itemsTable)
        .where(inArray(itemsTable.id, targetBufs))
        .all();
      for (const row of targetRows) {
        const id = encodeId(Buffer.from(row.id));
        targetItemMap.set(id, {
          $id: id,
          $collection: row.collection,
          $ref: row.ref,
          $changedAt: row.changedAt,
          ...(row.props && typeof row.props === "object" && !Array.isArray(row.props)
            ? row.props
            : {}),
        });
      }
    }

    // Group resolved links by source item
    const linksByItem = new Map<string, ResolvedLink[]>();
    for (const row of rows) {
      const fromId = encodeId(Buffer.from(row.from));
      if (!linksByItem.has(fromId)) linksByItem.set(fromId, []);
      const resolved: ResolvedLink = row.internal
        ? ((targetItemMap.get(encodeId(Buffer.from(row.to))) as ResolvedLink) ?? null)
        : row.to.toString("utf8");
      linksByItem.get(fromId)!.push(resolved);
    }

    for (const item of items) {
      item.links = linksByItem.get(item.$id) ?? [];
    }
  }
}
