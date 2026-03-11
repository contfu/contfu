import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { PropertyType, type Block, type ImageBlock } from "@contfu/core";
import { db } from "../../infra/db/db";
import { assetTable, itemAssetTable, itemsTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import type { MediaOptimizer, MediaStore, TransformMediaRule } from "../media/media";
import { processAssets, processPropertyAssets } from "./processAssets";

const itemId = Buffer.from([1, 2, 3]).toString("base64url");

function makeMediaStore(): MediaStore {
  return {
    write: mock(() => Promise.resolve()),
    read: mock(() => Promise.resolve(null)),
    exists: mock(() => Promise.resolve(false)),
  };
}

function makeMediaOptimizer(): MediaOptimizer {
  return {
    optimize: mock(() => Promise.resolve([])),
  };
}

function makeImageBlock(url: string, alt = "alt"): ImageBlock {
  return ["i", url, alt, [800]];
}

describe("processAssets", () => {
  beforeEach(async () => {
    await truncateAllTables();
    // Create collection, then insert parent item so FK constraint is satisfied
    await setCollection("test", "Test", {});
    await db.insert(itemsTable).values({
      id: Buffer.from([1, 2, 3]),
      collection: "test",
      changedAt: 1700000000,
    });

    // Mock global fetch to return image data
    globalThis.fetch = mock((_url: string | URL | Request) =>
      Promise.resolve(
        new Response(Buffer.from("fake-image-data"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    mock.restore();
  });

  test("downloads, optimizes, and creates asset records for ImageBlocks", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [["p", ["Hello"]], makeImageBlock("https://example.com/photo.png")];

    const result = await processAssets({
      itemId,
      content,
      mediaStore,
      mediaOptimizer,
    });

    expect(result).toHaveLength(2);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    // Asset id should be a hex hash (no extension)
    const imgBlock = result[1] as ImageBlock;
    expect(imgBlock[1]).not.toBe("https://example.com/photo.png");
    expect(imgBlock[1]).toMatch(/^[a-f0-9]{16}$/);

    // Asset record should exist in DB
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    expect(assets[0].originalUrl).toBe("https://example.com/photo.png");
    expect(assets[0].ext).toBe("avif");
    expect(assets[0].mediaType).toBe("image");

    // Junction row should exist
    const junctions = await db.select().from(itemAssetTable).all();
    expect(junctions).toHaveLength(1);
  });

  test("skips existing assets and creates junction link (idempotent dedup)", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    // First call creates the asset
    await processAssets({ itemId, content: [...content], mediaStore, mediaOptimizer });

    // Reset mocks
    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();

    // Second call with same URL should skip download but still link
    const content2: Block[] = [makeImageBlock("https://example.com/photo.png")];
    await processAssets({ itemId, content: content2, mediaStore, mediaOptimizer });

    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    // Still only one asset record
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
  });

  test("many-to-many: same asset linked to multiple items", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();

    // Insert second item
    const itemId2Buf = Buffer.from([4, 5, 6]);
    const itemId2 = itemId2Buf.toString("base64url");
    await db.insert(itemsTable).values({
      id: itemId2Buf,
      collection: "test",
      changedAt: 1700000000,
    });

    // Process same image for item 1
    await processAssets({
      itemId,
      content: [makeImageBlock("https://example.com/shared.png")],
      mediaStore,
      mediaOptimizer,
    });

    // Process same image for item 2
    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();
    await processAssets({
      itemId: itemId2,
      content: [makeImageBlock("https://example.com/shared.png")],
      mediaStore,
      mediaOptimizer,
    });

    // Only one asset, but two junction rows
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);

    const junctions = await db.select().from(itemAssetTable).all();
    expect(junctions).toHaveLength(2);

    // Second call should not re-download
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("handles content with no images (no-op)", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [
      ["p", ["Hello"]],
      ["1", ["Heading"]],
    ];

    const result = await processAssets({ itemId, content, mediaStore, mediaOptimizer });

    expect(result).toBe(content);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("continues on fetch failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 404 })),
    ) as unknown as typeof fetch;

    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [makeImageBlock("https://example.com/missing.png")];

    const result = await processAssets({ itemId, content, mediaStore, mediaOptimizer });

    expect(result).toHaveLength(1);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(0);
  });

  test("stores assets as-is without optimizer", async () => {
    const mediaStore = makeMediaStore();
    const content: Block[] = [["p", ["Hello"]], makeImageBlock("https://example.com/photo.png")];

    const result = await processAssets({
      itemId,
      content,
      mediaStore,
    });

    expect(result).toHaveLength(2);
    expect(mediaStore.write).toHaveBeenCalledTimes(1);

    const imgBlock = result[1] as ImageBlock;
    expect(imgBlock[1]).toMatch(/^[a-f0-9]{16}$/);

    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    expect(assets[0].ext).toBe("png");
  });

  test("same pathname with different query params produces same id", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const url1 = "https://s3.amazonaws.com/bucket/image.png?X-Amz-Signature=abc123&expires=100";
    const url2 = "https://s3.amazonaws.com/bucket/image.png?X-Amz-Signature=def456&expires=200";

    const content1: Block[] = [makeImageBlock(url1)];
    await processAssets({ itemId, content: content1, mediaStore, mediaOptimizer });

    const id1 = (content1[0] as ImageBlock)[1];

    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();

    const content2: Block[] = [makeImageBlock(url2)];
    await processAssets({ itemId, content: content2, mediaStore, mediaOptimizer });

    const id2 = (content2[0] as ImageBlock)[1];

    // Same pathname → same id, so second call should skip download
    expect(id1).toBe(id2);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("downloads multiple images in parallel", async () => {
    const callOrder: string[] = [];
    globalThis.fetch = mock((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return new Promise<Response>((resolve) => {
        callOrder.push(`start:${urlStr}`);
        // Small delay to verify parallel behavior
        setTimeout(() => {
          callOrder.push(`end:${urlStr}`);
          resolve(
            new Response(Buffer.from("fake-image-data"), {
              status: 200,
              headers: { "Content-Type": "image/png" },
            }),
          );
        }, 10);
      });
    }) as unknown as typeof fetch;

    const mediaStore = makeMediaStore();
    const content: Block[] = [
      makeImageBlock("https://example.com/a.png"),
      makeImageBlock("https://example.com/b.png"),
    ];

    await processAssets({ itemId, content, mediaStore });

    // Both fetches should have started before either completed
    const firstEnd = callOrder.findIndex((e) => e.startsWith("end:"));
    const starts = callOrder.slice(0, firstEnd).filter((e) => e.startsWith("start:"));
    expect(starts).toHaveLength(2);

    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(2);
  });

  test("deduplicates same URL appearing multiple times in content", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [
      makeImageBlock("https://example.com/same.png"),
      makeImageBlock("https://example.com/same.png"),
    ];

    await processAssets({ itemId, content, mediaStore, mediaOptimizer });

    // Should only download once despite two blocks
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
  });

  test("whitelist: skips optimizer for non-whitelisted extension", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", include: ["jpg", "jpeg"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({ itemId, content, mediaStore, mediaOptimizer, transformMedia });

    // PNG not in whitelist → optimizer should NOT be called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    // Stored as-is with original extension
    expect(assets[0].ext).toBe("png");
  });

  test("whitelist: optimizes whitelisted extension", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      { mediaType: "image", include: ["jpg", "jpeg", "png"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({ itemId, content, mediaStore, mediaOptimizer, transformMedia });

    // PNG is in whitelist → optimizer should be called
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
  });

  test("blacklist: skips optimizer for blacklisted extension", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", exclude: ["png"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({ itemId, content, mediaStore, mediaOptimizer, transformMedia });

    // PNG is blacklisted → optimizer should NOT be called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    expect(assets[0].ext).toBe("png");
  });

  test("blacklist: optimizes non-blacklisted extension", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", exclude: ["gif"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({ itemId, content, mediaStore, mediaOptimizer, transformMedia });

    // PNG is not blacklisted → optimizer should be called
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
  });

  test("collection-scoped rule: ignores rule for non-matching collection", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      // This rule applies only to "other" collection, not "test"
      { mediaType: "image", exclude: ["png"], collections: ["other"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({
      itemId,
      content,
      mediaStore,
      mediaOptimizer,
      transformMedia,
      collection: "test",
    });

    // Rule doesn't apply to "test" collection → optimizer IS called normally
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
  });

  test("collection-scoped rule: applies rule for matching collection", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      { mediaType: "image", exclude: ["png"], collections: ["test"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processAssets({
      itemId,
      content,
      mediaStore,
      mediaOptimizer,
      transformMedia,
      collection: "test",
    });

    // Rule applies to "test" collection and PNG is excluded → optimizer NOT called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });
});

describe("processPropertyAssets", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await setCollection("test", "Test", {});
    await db.insert(itemsTable).values({
      id: Buffer.from([1, 2, 3]),
      collection: "test",
      changedAt: 1700000000,
    });

    globalThis.fetch = mock((_url: string | URL | Request) =>
      Promise.resolve(
        new Response(Buffer.from("fake-image-data"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    mock.restore();
  });

  test("FILE prop gets downloaded and replaced with asset id", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyAssets({
      itemId,
      props: { cover: "https://example.com/cover.png", title: "Hello" },
      schema: { cover: PropertyType.FILE, title: PropertyType.STRING },
      mediaStore,
      mediaOptimizer,
    });

    expect(result.cover).toMatch(/^[a-f0-9]{16}$/);
    expect(result.cover).not.toBe("https://example.com/cover.png");
    expect(result.title).toBe("Hello");
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
  });

  test("FILES prop (string[]) gets each URL processed", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyAssets({
      itemId,
      props: {
        images: ["https://example.com/a.png", "https://example.com/b.jpg"],
      },
      schema: { images: PropertyType.FILES },
      mediaStore,
      mediaOptimizer,
    });

    const images = result.images as string[];
    expect(images).toHaveLength(2);
    expect(images[0]).toMatch(/^[a-f0-9]{16}$/);
    expect(images[1]).toMatch(/^[a-f0-9]{16}$/);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(2);
  });

  test("non-FILE props are untouched", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyAssets({
      itemId,
      props: { title: "Hello", count: 42 },
      schema: { title: PropertyType.STRING, count: PropertyType.NUMBER },
      mediaStore,
      mediaOptimizer,
    });

    expect(result.title).toBe("Hello");
    expect(result.count).toBe(42);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("null prop values are skipped", async () => {
    const mediaStore = makeMediaStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyAssets({
      itemId,
      props: { cover: null },
      schema: { cover: PropertyType.FILE },
      mediaStore,
      mediaOptimizer,
    });

    expect(result.cover).toBeNull();
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });
});
