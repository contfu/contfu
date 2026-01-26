import { eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../db/db";
import { assetTable, pageTable, type DbAsset, type NewAsset } from "../db/schema";
import type { AssetData } from "./asset-types";

export async function createAsset<T extends AssetData>(asset: T, ctx = db): Promise<T> {
  await ctx.insert(assetTable).values(assetToDb(asset) as NewAsset);
  return asset;
}

export async function getAssetsByPage(pageId: string, ctx = db): Promise<AssetData[]> {
  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(eq(assetTable.pageId, fromHex(pageId)))
    .all();
  return dbos.map((dbo) => assetFromDb(dbo));
}

export async function deleteAssetsByPage(pageId: string, ctx = db): Promise<void> {
  await ctx.delete(assetTable).where(eq(assetTable.pageId, fromHex(pageId)));
}

export async function getOrphanAssets(ctx = db): Promise<AssetData[]> {
  const pages = await ctx.select().from(pageTable).all();
  const pageIds = pages.map((p) => p.id);

  if (pageIds.length === 0) {
    const allAssets = await ctx.select().from(assetTable).all();
    return allAssets.map((dbo) => assetFromDb(dbo));
  }

  const dbos = await ctx
    .select()
    .from(assetTable)
    .where(notInArray(assetTable.pageId, pageIds))
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
  return {
    id: fromHex(asset.id),
    pageId: fromHex(asset.pageId),
    canonical: asset.canonical,
    originalUrl: asset.originalUrl,
    format: asset.format,
    size: asset.size,
    createdAt: asset.createdAt,
  };
}

function assetFromDb(dbo: DbAsset): AssetData {
  return {
    id: toHex(dbo.id),
    pageId: toHex(dbo.pageId),
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
