import { eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { assetTable, itemsTable, type DbAsset, type NewAsset } from "../../infra/db/schema";
import type { AssetData } from "./asset-types";

export async function createAsset<T extends AssetData>(asset: T, ctx = db): Promise<T> {
  await ctx.insert(assetTable).values(assetToDb(asset) as NewAsset);
  return asset;
}

export async function getAssetsByItem(itemId: string, ctx = db): Promise<AssetData[]> {
  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(eq(assetTable.itemId, fromHex(itemId)))
    .all();
  return dbos.map((dbo) => assetFromDb(dbo));
}

export async function deleteAssetsByItem(itemId: string, ctx = db): Promise<void> {
  await ctx.delete(assetTable).where(eq(assetTable.itemId, fromHex(itemId)));
}

export async function getOrphanAssets(ctx = db): Promise<AssetData[]> {
  const items = await ctx.select().from(itemsTable).all();
  const itemIds = items.map((item) => item.id);

  if (itemIds.length === 0) {
    const allAssets = await ctx.select().from(assetTable).all();
    return allAssets.map((dbo) => assetFromDb(dbo));
  }

  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(notInArray(assetTable.itemId, itemIds))
    .all();
  return dbos.map((dbo) => assetFromDb(dbo));
}

export async function deleteAssets(ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  await ctx.delete(assetTable).where(
    inArray(
      assetTable.id,
      ids.map((id) => fromHex(id)),
    ),
  );
}

export async function getAsset(id: string, ctx = db): Promise<AssetData | null> {
  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(eq(assetTable.id, fromHex(id)))
    .all();
  return dbos.length > 0 ? assetFromDb(dbos[0]) : null;
}

export async function getAssetByCanonical(canonical: string, ctx = db): Promise<AssetData | null> {
  const dbos = await ctx.select().from(assetTable).where(eq(assetTable.canonical, canonical)).all();
  return dbos.length > 0 ? assetFromDb(dbos[0]) : null;
}

function assetToDb(asset: AssetData): NewAsset {
  const itemId = asset.itemId ?? asset.pageId;
  if (!itemId) throw new Error("Asset itemId is required");

  return {
    id: fromHex(asset.id),
    itemId: fromHex(itemId),
    canonical: asset.canonical,
    originalUrl: asset.originalUrl,
    format: asset.format,
    size: asset.size,
    createdAt: asset.createdAt,
  };
}

function assetFromDb(dbo: DbAsset): AssetData {
  const itemId = toHex(dbo.itemId);
  return {
    id: toHex(dbo.id),
    itemId,
    pageId: itemId,
    canonical: dbo.canonical,
    originalUrl: dbo.originalUrl,
    format: dbo.format,
    size: dbo.size,
    createdAt: dbo.createdAt,
  };
}

function fromHex(hex: string): Buffer {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  return Buffer.from(hex, "hex");
}

function toHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/** @deprecated Use getAssetsByItem instead. */
export const getAssetsByPage = getAssetsByItem;
/** @deprecated Use deleteAssetsByItem instead. */
export const deleteAssetsByPage = deleteAssetsByItem;
