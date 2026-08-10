/* oxlint-disable typescript/unbound-method -- mock method references in expect() assertions are intentionally unbound */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { FileStatus } from "../../domain/file-status";
import type { FileStore } from "../../domain/files";
import type { MediaOptimizer, TransformMediaRule } from "../../domain/media";
import { db } from "../../infra/db/db";
import { fileTable, itemsTable, mediaMasterTable, mediaVariantTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import { configureMediaQueue } from "./mediaQueue";
import { reconcileConfiguredMediaMasters } from "./reconcileConfiguredMediaMasters";
import { processPropertyFiles } from "./processPropertyFiles";

function makeFileStore(): FileStore {
  return {
    write: mock(() => Promise.resolve()),
    read: mock(() => Promise.resolve(null)),
    exists: mock(() => Promise.resolve(false)),
  };
}

function optimizer(): MediaOptimizer {
  return {
    optimize: mock((path: string, input: Buffer, mediaType: "image" | "video" | "audio") => {
      const ext = mediaType === "image" ? "avif" : mediaType === "video" ? "mp4" : "opus";
      const prefix = path.includes(".master.") ? "master" : "out";
      const data = Buffer.from(`${prefix}:${mediaType}:${input.toString("utf8")}`);
      return Promise.resolve([{ path: `${path}.${ext}`, ext, size: data.byteLength, data }]);
    }),
  };
}

async function waitUntilReady(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const files = db.select().from(fileTable).all();
    if (files.length > 0 && files.every((file) => file.status === FileStatus.Ready)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for media queue");
}

async function createDownloadedFile(
  url: string,
  mediaOptimizer: MediaOptimizer,
  fileStore = makeFileStore(),
) {
  await processPropertyFiles({
    itemId: 1,
    props: { asset: url },
    schema: { asset: PropertyType.FILE },
    fileStore,
    mediaOptimizer,
    collection: "test",
  });
  configureMediaQueue({ fileStore, mediaOptimizer, mediaMaster: undefined, concurrency: 1 });
  await waitUntilReady();
}

describe("media masters", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("test", "Test", { asset: PropertyType.FILE });
    db.insert(itemsTable).values({ id: 1, collection: "test", changedAt: 1700000000 }).run();
    globalThis.fetch = mock((url: string | URL | Request) => {
      const value = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return Promise.resolve(new Response(Buffer.from(value), { status: 200 }));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    configureMediaQueue({ mediaMaster: false, concurrency: 1 });
    mock.restore();
  });

  test.each([
    ["image", "https://example.com/photo.png", "avif"],
    ["video", "https://example.com/clip.mp4", "mp4"],
    ["audio", "https://example.com/sound.mp3", "opus"],
  ] as const)("stores default %s masters", async (mediaType, url, ext) => {
    const mediaOptimizer = optimizer();

    await createDownloadedFile(url, mediaOptimizer);

    const masters = db.select().from(mediaMasterTable).all();
    expect(masters).toHaveLength(1);
    expect(masters[0]).toMatchObject({ mediaType, ext, format: ext });
    expect(masters[0].metadata.fallback).toBe(false);
    expect(masters[0].data.toString("utf8")).toStartWith(`master:${mediaType}:`);
  });

  test("falls back to source bytes when master conversion fails", async () => {
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock((path: string, input: Buffer) => {
        if (path.includes(".master.")) throw new Error("boom");
        return Promise.resolve([{ path, ext: "avif", size: input.byteLength, data: input }]);
      }),
    };

    await createDownloadedFile("https://example.com/photo.png", mediaOptimizer);

    const master = db.select().from(mediaMasterTable).get()!;
    expect(master.ext).toBe("png");
    expect(master.metadata.fallback).toBe(true);
    expect(master.metadata.fallbackReason).toBe("boom");
    expect(master.data.toString("utf8")).toBe("https://example.com/photo.png");
  });

  test("mediaMaster false opts out", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = optimizer();

    await processPropertyFiles({
      itemId: 1,
      props: { asset: "https://example.com/photo.png" },
      schema: { asset: PropertyType.FILE },
      fileStore,
      mediaOptimizer,
      collection: "test",
    });
    configureMediaQueue({ fileStore, mediaOptimizer, mediaMaster: false, concurrency: 1 });
    await waitUntilReady();

    expect(db.select().from(mediaMasterTable).all()).toHaveLength(0);
  });

  test("requests a source refresh when an ephemeral media URL has expired", async () => {
    const onCloudRepair = mock(() => {});
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 403 })),
    ) as unknown as typeof fetch;
    const fileStore = makeFileStore();

    await processPropertyFiles({
      itemId: 1,
      props: { asset: "https://example.com/expired.png" },
      schema: { asset: PropertyType.FILE },
      fileStore,
      collection: "test",
    });
    configureMediaQueue({ fileStore, mediaMaster: undefined, concurrency: 1, onCloudRepair });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onCloudRepair).toHaveBeenCalledWith({ collection: "test", itemIds: [1], source: true });
  });

  test("retries a managed file failure without requesting source repair", async () => {
    const onCloudRepair = mock(() => {});
    const fileStore = makeFileStore();
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 403 })),
    ) as unknown as typeof fetch;

    await processPropertyFiles({
      itemId: 1,
      props: { asset: "https://cloud.example/api/files/handle" },
      schema: { asset: PropertyType.FILE },
      fileStore,
      collection: "test",
    });
    configureMediaQueue({
      fileStore,
      mediaMaster: undefined,
      concurrency: 1,
      applicationKey: Buffer.alloc(32, 1),
      contfuOrigin: "https://cloud.example",
      onCloudRepair,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(db.select().from(fileTable).get()?.status).toBe(FileStatus.Pending);
    expect(onCloudRepair).not.toHaveBeenCalled();
  });

  test("rederives changed fingerprints from master without fetching and only pregenerates configured variants", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = optimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", format: "webp" }];

    await processPropertyFiles({
      itemId: 1,
      props: { asset: "https://example.com/photo.png" },
      schema: { asset: PropertyType.FILE },
      fileStore,
      mediaOptimizer,
      transformMedia,
      collection: "test",
      pregenerate: [{ mediaType: "image", format: "webp", resize: { width: 320 } }],
    });
    configureMediaQueue({
      fileStore,
      mediaOptimizer,
      mediaMaster: undefined,
      transformMedia,
      concurrency: 1,
    });
    await waitUntilReady();

    const firstFingerprint = db.select().from(mediaMasterTable).get()!.configFingerprint;
    expect(db.select().from(mediaVariantTable).all()).toHaveLength(1);
    (globalThis.fetch as unknown as ReturnType<typeof mock>).mockClear();
    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();

    configureMediaQueue({
      fileStore,
      mediaOptimizer,
      mediaMaster: undefined,
      transformMedia: [{ mediaType: "image", format: "avif", quality: 75 }],
      mediaVariants: {
        default: {
          presets: {
            eager: { mediaType: "image", format: "avif", resize: { width: 640 } },
            lazy: { mediaType: "image", format: "avif", resize: { width: 1200 } },
          },
          pregenerate: ["eager"],
        },
      },
      concurrency: 1,
    });
    await reconcileConfiguredMediaMasters();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    const nextFingerprint = db.select().from(mediaMasterTable).get()!.configFingerprint;
    expect(nextFingerprint).not.toBe(firstFingerprint);
    expect(db.select().from(mediaVariantTable).all()).toHaveLength(1);
    expect(mediaOptimizer.optimize).toHaveBeenCalled();
  });
});
