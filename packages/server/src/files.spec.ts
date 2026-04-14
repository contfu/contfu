import { afterEach, describe, expect, mock, test } from "bun:test";
import type { FileStore, MediaOptimizer } from "@contfu/contfu";
import { fileStore as defaultFileStore } from "@contfu/contfu";
import { buildFileOpts, getFileStore, getMediaOptimizer } from "./files";

describe("buildFileOpts", () => {
  test("builds image conversion options from query params", () => {
    const url = new URL("http://localhost/files/file.avif?w=640&q=80");

    expect(buildFileOpts(url, "image")).toEqual({
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
    const url = new URL("http://localhost/files/file.avif");
    expect(buildFileOpts(url, "image")).toBeNull();
  });

  test("returns null for non-media file extensions", () => {
    const url = new URL("http://localhost/files/file.bin?w=640");
    expect(buildFileOpts(url, null)).toBeNull();
  });
});

describe("getFileStore", () => {
  const originalFileUrl = process.env.FILE_URL;

  afterEach(() => {
    mock.restore();
    if (originalFileUrl === undefined) {
      delete process.env.FILE_URL;
    } else {
      process.env.FILE_URL = originalFileUrl;
    }
  });

  test("uses the default DB store when FILE_URL is not set", async () => {
    delete process.env.FILE_URL;

    const store = await getFileStore();
    expect(store).toBe(defaultFileStore);
  });

  test("uses the file store when FILE_URL is set", async () => {
    process.env.FILE_URL = "s3://files-bucket/files";

    const store = await getFileStore({
      importModule: mock((name: string) => {
        expect(name).toBe("@contfu/bun-file-store");
        return Promise.resolve({
          FileStore: class implements FileStore {
            constructor(readonly url: string) {
              expect(url).toBe("s3://files-bucket/files");
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
