import type { AssetData } from "./asset-types";
import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import "../../test/setup";
import { db } from "../core/db/db";
import { assetTable, pageTable, type NewAsset, type NewPage } from "../core/db/schema";
import {
  createAsset,
  deleteAssets,
  deleteAssetsByPage,
  getAsset,
  getAssetByCanonical,
  getAssetsByPage,
  getOrphanAssets,
} from "./asset-datasource";

const pageId1 = "1234567890abcdef";
const pageId2 = "2234567890abcdef";
const assetId1 = "a1a1a1a1a1a1a1a1";
const assetId2 = "a2a2a2a2a2a2a2a2";
const assetId3 = "a3a3a3a3a3a3a3a3";

describe("createAsset()", () => {
  it("should insert a new asset", async () => {
    await insertPage();

    await createAsset(asset);

    expect(await selectAllAssets()).toEqual([dbAsset]);
  });

  it("should return the created asset", async () => {
    await insertPage();

    const result = await createAsset(asset);

    expect(result).toEqual(asset);
  });
});

describe("getAsset()", () => {
  it("should return an asset by id", async () => {
    await insertPage();
    await insertAsset();

    const a = await getAsset(assetId1);

    expect(a).toEqual(asset);
  });

  it("should return null if there is no asset", async () => {
    const a = await getAsset("nonexistent1234567");

    expect(a).toBeNull();
  });
});

describe("getAssetByCanonical()", () => {
  it("should return an asset by canonical path", async () => {
    await insertPage();
    await insertAsset();

    const a = await getAssetByCanonical("assets/test-image.webp");

    expect(a).toEqual(asset);
  });

  it("should return null if there is no asset with the canonical path", async () => {
    const a = await getAssetByCanonical("nonexistent/path.webp");

    expect(a).toBeNull();
  });
});

describe("getAssetsByPage()", () => {
  it("should return all assets for a page", async () => {
    await insertPage();
    await insertAsset();
    await insertAsset({
      ...dbAsset,
      id: fromHex(assetId2),
      canonical: "assets/test-image-2.webp",
    });

    const assets = await getAssetsByPage(pageId1);

    expect(assets).toHaveLength(2);
    expect(assets[0]).toEqual(asset);
    expect(assets[1]).toEqual({
      ...asset,
      id: assetId2,
      canonical: "assets/test-image-2.webp",
    });
  });

  it("should return empty array if page has no assets", async () => {
    await insertPage();

    const assets = await getAssetsByPage(pageId1);

    expect(assets).toEqual([]);
  });

  it("should only return assets for the specified page", async () => {
    await insertPage();
    await insertPage({ ...dbPage, id: fromHex(pageId2), path: "test2" });
    await insertAsset();
    await insertAsset({
      ...dbAsset,
      id: fromHex(assetId2),
      pageId: fromHex(pageId2),
      canonical: "assets/test-image-2.webp",
    });

    const assets = await getAssetsByPage(pageId1);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual(asset);
  });
});

describe("deleteAssetsByPage()", () => {
  it("should delete all assets for a page", async () => {
    await insertPage();
    await insertAsset();
    await insertAsset({
      ...dbAsset,
      id: fromHex(assetId2),
      canonical: "assets/test-image-2.webp",
    });

    await deleteAssetsByPage(pageId1);

    expect(await selectAllAssets()).toEqual([]);
  });

  it("should not delete assets for other pages", async () => {
    await insertPage();
    await insertPage({ ...dbPage, id: fromHex(pageId2), path: "test2" });
    await insertAsset();
    const asset2 = {
      ...dbAsset,
      id: fromHex(assetId2),
      pageId: fromHex(pageId2),
      canonical: "assets/test-image-2.webp",
    };
    await insertAsset(asset2);

    await deleteAssetsByPage(pageId1);

    expect(await selectAllAssets()).toEqual([asset2]);
  });
});

describe("deleteAssets()", () => {
  it("should delete assets by ids", async () => {
    await insertPage();
    await insertAsset();
    const asset2 = {
      ...dbAsset,
      id: fromHex(assetId2),
      canonical: "assets/test-image-2.webp",
    };
    await insertAsset(asset2);
    await insertAsset({
      ...dbAsset,
      id: fromHex(assetId3),
      canonical: "assets/test-image-3.webp",
    });

    await deleteAssets([assetId1, assetId3]);

    expect(await selectAllAssets()).toEqual([asset2]);
  });

  it("should handle empty array", async () => {
    await insertPage();
    await insertAsset();

    await deleteAssets([]);

    expect(await selectAllAssets()).toEqual([dbAsset]);
  });
});

describe("getOrphanAssets()", () => {
  it("should return empty array when all assets have pages", async () => {
    await insertPage();
    await insertAsset();

    const orphans = await getOrphanAssets();

    expect(orphans).toEqual([]);
  });

  it("should not return assets that have valid pages", async () => {
    await insertPage();
    await insertPage({ ...dbPage, id: fromHex(pageId2), path: "test2" });
    await insertAsset();
    await insertAsset({
      ...dbAsset,
      id: fromHex(assetId2),
      pageId: fromHex(pageId2),
      canonical: "assets/test-image-2.webp",
    });

    const orphans = await getOrphanAssets();

    expect(orphans).toEqual([]);
  });

  it("should return orphan assets when page does not exist", async () => {
    // To test orphan detection, we need to disable FK constraints temporarily
    // This simulates scenarios like data corruption or migration issues
    await insertPage();
    await insertAsset();

    // Disable FK constraints, delete page, then re-enable
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    await db.delete(pageTable).execute();
    await db.run(sql`PRAGMA foreign_keys = ON`);

    const orphans = await getOrphanAssets();

    expect(orphans).toEqual([asset]);
  });

  it("should return all assets when there are no pages", async () => {
    // Disable FK constraints to insert assets without pages
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    await db.insert(assetTable).values(dbAsset);
    await db.insert(assetTable).values({
      ...dbAsset,
      id: fromHex(assetId2),
      canonical: "assets/test-image-2.webp",
    });
    await db.run(sql`PRAGMA foreign_keys = ON`);

    const orphans = await getOrphanAssets();

    expect(orphans).toHaveLength(2);
  });
});

// Test fixtures
const asset: AssetData = {
  id: assetId1,
  pageId: pageId1,
  canonical: "assets/test-image.webp",
  originalUrl: "https://example.com/image.png",
  format: "webp",
  size: 12345,
  createdAt: 1700000000,
};

const dbAsset: NewAsset = {
  id: fromHex(asset.id),
  pageId: fromHex(asset.pageId),
  canonical: asset.canonical,
  originalUrl: asset.originalUrl,
  format: asset.format,
  size: asset.size,
  createdAt: asset.createdAt,
};

const dbPage: NewPage = {
  id: fromHex(pageId1),
  ref: "test-page",
  path: "test",
  collection: "foo",
  title: "Test Page",
  description: "A test page",
  content: "[]",
  props: "{}",
  author: null,
  connection: fromHex("1234567890abcdef"),
  publishedAt: 0,
  createdAt: 0,
  updatedAt: null,
  changedAt: 0,
};

// Helper functions
async function insertPage(p: NewPage = dbPage) {
  await db.insert(pageTable).values(p).execute();
}

async function insertAsset(a: NewAsset = dbAsset) {
  await db.insert(assetTable).values(a).execute();
}

async function selectAllAssets() {
  return await db.select().from(assetTable).all();
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}
