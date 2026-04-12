import { afterEach, describe, expect, mock, test } from "bun:test";
import type { AssetStore, MediaOptimizer } from "@contfu/contfu";
import { assetStore as defaultAssetStore } from "@contfu/contfu";
import { buildAssetOpts, getAssetStore, getMediaOptimizer } from "./assets";

describe("buildAssetOpts", () => {
  test("builds image conversion options from query params", () => {
    const url = new URL("http://localhost/assets/asset.avif?w=640&q=80");

    expect(buildAssetOpts(url, "image")).toEqual({
      mediaType: "image",
      width: 640,
      height: undefined,
      quality: 80,
      fit: undefined,
      rotate: undefined,
      cropLeft: undefined,
      cropTop: undefined,
      cropWidth: undefined,
      cropHeight: undefined,
    });
  });

  test("returns null when no transform params are present", () => {
    const url = new URL("http://localhost/assets/asset.avif");
    expect(buildAssetOpts(url, "image")).toBeNull();
  });

  test("returns null for non-media asset extensions", () => {
    const url = new URL("http://localhost/assets/asset.bin?w=640");
    expect(buildAssetOpts(url, null)).toBeNull();
  });
});

describe("getAssetStore", () => {
  const originalAssetUrl = process.env.ASSET_URL;

  afterEach(() => {
    mock.restore();
    if (originalAssetUrl === undefined) {
      delete process.env.ASSET_URL;
    } else {
      process.env.ASSET_URL = originalAssetUrl;
    }
  });

  test("uses the default DB store when ASSET_URL is not set", async () => {
    delete process.env.ASSET_URL;

    const store = await getAssetStore();
    expect(store).toBe(defaultAssetStore);
  });

  test("uses the file store when ASSET_URL is set", async () => {
    process.env.ASSET_URL = "s3://assets-bucket/files";

    const store = await getAssetStore({
      importModule: mock((name: string) => {
        expect(name).toBe("@contfu/bun-file-store");
        return Promise.resolve({
          FileStore: class implements AssetStore {
            constructor(readonly url: string) {
              expect(url).toBe("s3://assets-bucket/files");
            }
            read = mock(() => Promise.resolve(null));
            write = mock(() => Promise.resolve());
            delete = mock(() => Promise.resolve());
          },
        });
      }),
    });

    expect(store).toBeDefined();
  });
});

describe("getMediaOptimizer", () => {
  const originalM4kUrl = process.env.M4K_URL;

  afterEach(() => {
    mock.restore();
    if (originalM4kUrl === undefined) {
      delete process.env.M4K_URL;
    } else {
      process.env.M4K_URL = originalM4kUrl;
    }
  });

  test("uses the remote optimizer when M4K_URL is set", async () => {
    process.env.M4K_URL = "http://m4k:8080";

    const optimizer = await getMediaOptimizer({
      importModule: mock((name: string) => {
        expect(name).toBe("@contfu/media-optimizer-remote");
        return Promise.resolve({
          M4kRemoteOptimizer: class implements MediaOptimizer {
            constructor(readonly url: string) {
              expect(url).toBe("http://m4k:8080");
            }
            optimize = mock(() => Promise.resolve([]));
          },
        });
      }),
    });

    expect(optimizer).toBeDefined();
  });

  test("uses the local optimizer when M4K_URL is not set", async () => {
    delete process.env.M4K_URL;

    const optimizer = await getMediaOptimizer({
      importModule: mock((name: string) => {
        expect(name).toBe("@contfu/media-optimizer");
        return Promise.resolve({
          M4kOptimizer: class implements MediaOptimizer {
            optimize = mock(() => Promise.resolve([]));
          },
        });
      }),
    });

    expect(optimizer).toBeDefined();
  });
});
