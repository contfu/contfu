/* oxlint-disable typescript/unbound-method, typescript/await-thenable -- Bun test mocks and rejected-expect helpers trigger false positives here */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { db } from "../../infra/db/db";
import { mediaVariantTable } from "../../infra/db/schema";
import type { AssetData } from "../../infra/types/content-types";
import { truncateAllTables } from "../../../test/setup";
import { createAsset } from "./createAsset";
import { AssetLoadError, loadAsset } from "./loadAsset";
import type { AssetStore } from "../../domain/assets";
import type { MediaOptimizer } from "../../domain/media";

const assetId = Buffer.from([1, 2, 3, 4]).toString("base64url");
const sourceData = Buffer.from("source-image-data");

function createTestAsset(): AssetData {
  return {
    id: assetId,
    originalUrl: "https://example.com/image.png",
    mediaType: "image",
    ext: "png",
    size: sourceData.byteLength,
    data: sourceData,
    createdAt: 1,
  };
}

function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Response(stream).arrayBuffer().then((buffer) => Buffer.from(buffer));
}

describe("loadAsset", () => {
  beforeEach(() => {
    truncateAllTables();
    createAsset(createTestAsset());
  });

  test("loads, converts, and streams an asset", async () => {
    const assetStore: AssetStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${assetId}.avif`,
            ext: "avif",
            size: 3,
            data: Buffer.from("out"),
          },
        ]),
      ),
    };

    const stream = await loadAsset(
      `${assetId}.avif`,
      { width: 100 },
      { assetStore, mediaOptimizer },
    );

    expect(await streamToBuffer(stream)).toEqual(Buffer.from("out"));
    expect(assetStore.read).toHaveBeenCalledWith(`${assetId}.png`);
    expect(mediaOptimizer.optimize).toHaveBeenCalledWith(
      `${assetId}.png`,
      sourceData,
      "image",
      expect.objectContaining({ avif: [[100, undefined, undefined]] }),
    );
  });

  test("rejects invalid asset paths", async () => {
    await expect(loadAsset(assetId, {}, {})).rejects.toEqual(
      new AssetLoadError("Asset path must end with <id>.<media-ext>", 400),
    );
  });

  test("rejects unsupported extensions", async () => {
    await expect(loadAsset(`${assetId}.txt`, {}, {})).rejects.toEqual(
      new AssetLoadError("Unsupported media extension: txt", 400),
    );
  });

  test("returns cached variants without re-optimizing", async () => {
    const assetStore: AssetStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${assetId}.avif`,
            ext: "avif",
            size: 6,
            data: Buffer.from("cached"),
          },
        ]),
      ),
    };

    const first = await loadAsset(
      `${assetId}.avif`,
      { width: 320 },
      { assetStore, mediaOptimizer, cache: true },
    );
    expect(await streamToBuffer(first)).toEqual(Buffer.from("cached"));
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    const second = await loadAsset(
      `${assetId}.avif`,
      { width: 320 },
      { assetStore, mediaOptimizer, cache: true },
    );
    expect(await streamToBuffer(second)).toEqual(Buffer.from("cached"));
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    const variants = db.select().from(mediaVariantTable).all();
    expect(variants).toHaveLength(1);
  });

  test("skips cache writes when disabled", async () => {
    const assetStore: AssetStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${assetId}.avif`,
            ext: "avif",
            size: 2,
            data: Buffer.from("ok"),
          },
        ]),
      ),
    };

    await loadAsset(`${assetId}.avif`, {}, { assetStore, mediaOptimizer, cache: false });

    expect(db.select().from(mediaVariantTable).all()).toHaveLength(0);
  });

  test("fails when the source asset is missing from the store", async () => {
    const assetStore: AssetStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() => Promise.resolve([])),
    };

    await expect(loadAsset(`${assetId}.avif`, {}, { assetStore, mediaOptimizer })).rejects.toEqual(
      new AssetLoadError("Not found", 404),
    );
  });
});
