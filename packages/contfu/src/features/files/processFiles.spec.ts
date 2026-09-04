/* oxlint-disable typescript/unbound-method -- mock method references in expect() assertions are intentionally unbound */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { PropertyType, type Block, type ImageBlock } from "@contfu/core";
import { eq } from "drizzle-orm";
import { encodeId } from "../../infra/ids";
import { FileStatus } from "../../domain/file-status";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable, itemsTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import type { FileStore } from "../../domain/files";
import type { MediaOptimizer, TransformMediaRule } from "../../domain/media";
import { configureMediaQueue } from "./mediaQueue";
import { processFiles } from "./processFiles";
import { processPropertyFiles } from "./processPropertyFiles";
import { getFilesByItem } from "./getFilesByItem";

const itemId = 1;
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l1mQ8wAAAABJRU5ErkJggg==",
  "base64",
);

async function waitUntilReady(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const files = db.select().from(fileTable).all();
    if (files.some((file) => file.status === 2)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for media queue");
}

function makeFileStore(): FileStore {
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
  return ["i", url, alt];
}

describe("processFiles", () => {
  beforeEach(() => {
    truncateAllTables();
    // Create collection, then insert parent item so FK constraint is satisfied
    setCollection("test", "Test", {});
    db.insert(itemsTable)
      .values({
        id: 1,
        collection: "test",
        changedAt: 1700000000,
      })
      .run();

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

  test("downloads Files and records media metadata in the Contfu runtime", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [["p", ["Hello"]], makeImageBlock("https://example.com/photo.png")];

    const result = await processFiles({
      itemId,
      content,
      fileStore,
      mediaOptimizer,
    });

    expect(result).toHaveLength(2);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);

    // File id should be a hex hash (no extension)
    const imgBlock = result[1] as ImageBlock;
    expect(imgBlock[1]).not.toBe("https://example.com/photo.png");
    expect(imgBlock[1]).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);

    // Contfu runtime File record should exist in DB
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].data?.toString("utf8")).toBe("https://example.com/photo.png");
    expect(files[0].meta.ext).toBe("png");
    expect(files[0].mediaType).toBe("image");

    // Contfu runtime file link should exist
    const junctions = db.select().from(itemFileTable).all();
    expect(junctions).toHaveLength(1);
  });

  test("skips existing files and creates junction link (idempotent dedup)", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    // First Contfu runtime call creates the File
    await processFiles({ itemId, content: [...content], fileStore, mediaOptimizer });

    // Reset mocks
    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();

    // Second Contfu runtime call with same URL should skip download but still link
    const content2: Block[] = [makeImageBlock("https://example.com/photo.png")];
    await processFiles({ itemId, content: content2, fileStore, mediaOptimizer });

    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    // Still only one file record
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
  });

  test("requeues a failed file when refreshed content provides a new signed URL", async () => {
    const fileStore = makeFileStore();
    const firstUrl = "https://example.com/photo.png?token=expired";
    await processFiles({ itemId, content: [makeImageBlock(firstUrl)], fileStore });
    const file = db.select().from(fileTable).get()!;
    db.update(fileTable)
      .set({ status: FileStatus.Failed, meta: { ...file.meta, attempts: 1, error: "HTTP 403" } })
      .run();

    await processFiles({
      itemId,
      content: [makeImageBlock("https://example.com/photo.png?token=fresh")],
      fileStore,
    });

    const refreshed = db.select().from(fileTable).get()!;
    expect(refreshed.status).toBe(FileStatus.Pending);
    expect(refreshed.data?.toString()).toBe("https://example.com/photo.png?token=fresh");
    expect(refreshed.meta.attempts).toBe(0);
  });

  test("many-to-many: same file linked to multiple items", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();

    // Insert second item
    const itemId2 = 2;
    db.insert(itemsTable)
      .values({
        id: 2,
        collection: "test",
        changedAt: 1700000000,
      })
      .run();

    // Process same image for item 1
    await processFiles({
      itemId,
      content: [makeImageBlock("https://example.com/shared.png")],
      fileStore,
      mediaOptimizer,
    });

    // Process same image for item 2
    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();
    await processFiles({
      itemId: itemId2,
      content: [makeImageBlock("https://example.com/shared.png")],
      fileStore,
      mediaOptimizer,
    });

    // Only one file, but two junction rows
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);

    const junctions = db.select().from(itemFileTable).all();
    expect(junctions).toHaveLength(2);

    // Second call should not re-download
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("handles content with no images (no-op)", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [
      ["p", ["Hello"]],
      ["1", ["Heading"]],
    ];

    const result = await processFiles({ itemId, content, fileStore, mediaOptimizer });

    expect(result).toBe(content);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("continues on fetch failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 404 })),
    ) as unknown as typeof fetch;

    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [makeImageBlock("https://example.com/missing.png")];

    const result = await processFiles({ itemId, content, fileStore, mediaOptimizer });

    expect(result).toHaveLength(1);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
  });

  test("stores files as-is without optimizer", async () => {
    const fileStore = makeFileStore();
    const content: Block[] = [["p", ["Hello"]], makeImageBlock("https://example.com/photo.png")];

    const result = await processFiles({
      itemId,
      content,
      fileStore,
    });

    expect(result).toHaveLength(2);
    expect(fileStore.write).toHaveBeenCalledTimes(0);

    const imgBlock = result[1] as ImageBlock;
    expect(imgBlock[1]).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);

    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].meta.ext).toBe("png");
  });

  test("stores image dimensions and omits binary data from item file queries", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(png1x1, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    ) as unknown as typeof fetch;
    const fileStore = makeFileStore();
    const processedImage = Buffer.from("processed-image");
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: "image.png",
            ext: "png",
            size: processedImage.byteLength,
            data: processedImage,
          },
        ]),
      ),
      metadata: mock((input) => {
        expect(input).toEqual(png1x1);
        return Promise.resolve({ width: 1, height: 1 });
      }),
    };

    await processFiles({
      itemId,
      content: [makeImageBlock("https://example.com/photo.png")],
      fileStore,
      mediaOptimizer,
    });
    configureMediaQueue({ fileStore, mediaOptimizer, concurrency: 1 });
    await waitUntilReady();

    const rows = db.select().from(fileTable).all();
    expect(rows[0].meta.width).toBe(1);
    expect(rows[0].meta.height).toBe(1);

    const files = getFilesByItem(itemId);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ width: 1, height: 1 });
    expect(files[0]).not.toHaveProperty("data");
  });

  test("downloads an extensionless managed file with response metadata", async () => {
    const fileStore = makeFileStore();
    const key = Buffer.alloc(32, 9);
    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      requests.push({ url, authorization: new Headers(init?.headers).get("authorization") });
      if (url === "https://cloud.example/api/files/handle") {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { Location: "https://provider.example/download" },
          }),
        );
      }
      return Promise.resolve(
        new Response(png1x1, {
          headers: {
            // Providers may use a generic content type while the filename still
            // identifies the media format.
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="photo.png"',
          },
        }),
      );
    }) as unknown as typeof fetch;

    const content = await processFiles({
      itemId,
      content: [makeImageBlock("https://cloud.example/api/files/handle")],
      fileStore,
    });
    expect((content[0] as ImageBlock)[1]).toMatch(/^[a-f0-9]{16}\.bin$/);
    db.update(itemsTable).set({ content }).where(eq(itemsTable.id, itemId)).run();
    configureMediaQueue({
      fileStore,
      concurrency: 1,
      applicationKey: key,
      contfuOrigin: "https://cloud.example",
    });
    await waitUntilReady();

    const file = db.select().from(fileTable).get()!;
    expect(file.meta.ext).toBe("png");
    expect(file.meta.mimeType).toBe("application/octet-stream");
    expect(file.mediaType).toBe("image");
    expect(
      (
        db.select({ content: itemsTable.content }).from(itemsTable).get()!.content![0] as ImageBlock
      )[1],
    ).toBe(`${encodeId(file.id)}.png`);
    expect(requests).toEqual([
      {
        url: "https://cloud.example/api/files/handle",
        authorization: `Bearer ${key.toString("base64url")}`,
      },
      { url: "https://provider.example/download", authorization: null },
    ]);
  });

  test("prefers a recognized Content-Type over a conflicting filename", async () => {
    const fileStore = makeFileStore();
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(png1x1, {
          headers: {
            "Content-Type": "image/png",
            "Content-Disposition": 'attachment; filename="photo.jpg"',
          },
        }),
      ),
    ) as unknown as typeof fetch;

    const content = await processFiles({
      itemId,
      content: [makeImageBlock("https://example.com/download")],
      fileStore,
    });
    expect((content[0] as ImageBlock)[1]).toMatch(/^[a-f0-9]{16}\.bin$/);
    db.update(itemsTable).set({ content }).where(eq(itemsTable.id, itemId)).run();
    configureMediaQueue({ fileStore, concurrency: 1 });
    await waitUntilReady();

    const file = db.select().from(fileTable).get()!;
    expect(file.meta.ext).toBe("png");
    expect(file.mediaType).toBe("image");
  });

  test("preserves a direct external source extension when response metadata is generic", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(png1x1, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="download.bin"',
          },
        }),
      ),
    ) as unknown as typeof fetch;

    const content = await processFiles({
      itemId,
      content: [makeImageBlock("https://example.com/photo.jpg")],
      fileStore,
      mediaOptimizer,
    });
    db.update(itemsTable).set({ content }).where(eq(itemsTable.id, itemId)).run();
    configureMediaQueue({ fileStore, mediaOptimizer, concurrency: 1 });
    await waitUntilReady();

    const file = db.select().from(fileTable).get()!;
    expect(file.mediaType).toBe("image");
    expect(mediaOptimizer.optimize).toHaveBeenCalled();
  });

  test("derives non-image managed file metadata from the final response", async () => {
    const fileStore = makeFileStore();
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("pdf", {
          headers: { "Content-Type": "application/pdf" },
        }),
      ),
    ) as unknown as typeof fetch;

    const props = await processPropertyFiles({
      itemId,
      props: {
        asset: "https://cloud.example/api/files/document",
        assets: ["https://cloud.example/api/files/document"],
      },
      schema: { asset: PropertyType.FILE, assets: PropertyType.FILES },
      fileStore,
    });
    expect(props.asset).toMatch(/^[a-f0-9]{16}\.bin$/);
    db.update(itemsTable).set({ props }).where(eq(itemsTable.id, itemId)).run();
    configureMediaQueue({
      fileStore,
      concurrency: 1,
      applicationKey: Buffer.alloc(32, 5),
      contfuOrigin: "https://cloud.example",
    });
    await waitUntilReady();

    const file = db.select().from(fileTable).get()!;
    expect(file.meta.ext).toBe("pdf");
    expect(file.meta.mimeType).toBe("application/pdf");
    expect(file.mediaType).toBe("file");
    const persistedProps = db.select({ props: itemsTable.props }).from(itemsTable).get()!.props!;
    expect(persistedProps).toEqual({
      asset: `${encodeId(file.id)}.pdf`,
      assets: [`${encodeId(file.id)}.pdf`],
    });
  });

  test("same pathname with different query params produces same id", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const url1 = "https://s3.amazonaws.com/bucket/image.png?X-Amz-Signature=abc123&expires=100";
    const url2 = "https://s3.amazonaws.com/bucket/image.png?X-Amz-Signature=def456&expires=200";

    const content1: Block[] = [makeImageBlock(url1)];
    await processFiles({ itemId, content: content1, fileStore, mediaOptimizer });

    const id1 = (content1[0] as ImageBlock)[1];

    (mediaOptimizer.optimize as ReturnType<typeof mock>).mockClear();

    const content2: Block[] = [makeImageBlock(url2)];
    await processFiles({ itemId, content: content2, fileStore, mediaOptimizer });

    const id2 = (content2[0] as ImageBlock)[1];

    // Same pathname → same id, so second call should skip download
    expect(id1).toBe(id2);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("same path on different origins produces distinct file ids", async () => {
    const fileStore = makeFileStore();
    const first: Block[] = [makeImageBlock("https://tenant-a.example/logo.png?token=old")];
    const second: Block[] = [makeImageBlock("https://tenant-b.example/logo.png?token=new")];

    await processFiles({ itemId, content: first, fileStore });
    await processFiles({ itemId, content: second, fileStore });

    expect((first[0] as ImageBlock)[1]).not.toBe((second[0] as ImageBlock)[1]);
    expect(db.select().from(fileTable).all()).toHaveLength(2);
  });

  test("preserves legacy stored file references until the next remote sync", async () => {
    const legacyRef = "d4d2f8a02a5a16b9.png";
    const content: Block[] = [makeImageBlock(legacyRef)];
    const linked = new Set<string>();

    await processFiles({ itemId, content, fileStore: makeFileStore(), linked });

    expect((content[0] as ImageBlock)[1]).toBe(legacyRef);
    expect(linked).toEqual(new Set(["d4d2f8a02a5a16b9"]));
    expect(db.select().from(fileTable).all()).toHaveLength(0);
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

    const fileStore = makeFileStore();
    const content: Block[] = [
      makeImageBlock("https://example.com/a.png"),
      makeImageBlock("https://example.com/b.png"),
    ];

    await processFiles({ itemId, content, fileStore });

    // Both fetches should have started before either completed
    const firstEnd = callOrder.findIndex((e) => e.startsWith("end:"));
    const starts = callOrder.slice(0, firstEnd).filter((e) => e.startsWith("start:"));
    expect(starts).toHaveLength(0);

    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(2);
  });

  test("deduplicates same URL appearing multiple times in content", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const content: Block[] = [
      makeImageBlock("https://example.com/same.png"),
      makeImageBlock("https://example.com/same.png"),
    ];

    await processFiles({ itemId, content, fileStore, mediaOptimizer });

    // Should only download once despite two blocks
    expect(globalThis.fetch).toHaveBeenCalledTimes(0);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);

    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
  });

  test("whitelist: skips optimizer for non-whitelisted extension", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", include: ["jpg", "jpeg"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({ itemId, content, fileStore, mediaOptimizer, transformMedia });

    // PNG not in whitelist → optimizer should NOT be called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    // Stored as-is with original extension
    expect(files[0].meta.ext).toBe("png");
  });

  test("whitelist: optimizes whitelisted extension", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      { mediaType: "image", include: ["jpg", "jpeg", "png"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({ itemId, content, fileStore, mediaOptimizer, transformMedia });

    // PNG is in whitelist → optimizer should be called
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);
  });

  test("blacklist: skips optimizer for blacklisted extension", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", exclude: ["png"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({ itemId, content, fileStore, mediaOptimizer, transformMedia });

    // PNG is blacklisted → optimizer should NOT be called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();

    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].meta.ext).toBe("png");
  });

  test("blacklist: optimizes non-blacklisted extension", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [{ mediaType: "image", exclude: ["gif"] }];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({ itemId, content, fileStore, mediaOptimizer, transformMedia });

    // PNG is not blacklisted → optimizer should be called
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);
  });

  test("collection-scoped rule: ignores rule for non-matching collection", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      // This rule applies only to "other" collection, not "test"
      { mediaType: "image", exclude: ["png"], collections: ["other"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({
      itemId,
      content,
      fileStore,
      mediaOptimizer,
      transformMedia,
      collection: "test",
    });

    // Rule doesn't apply to "test" collection → optimizer IS called normally
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);
  });

  test("collection-scoped rule: applies rule for matching collection", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const transformMedia: TransformMediaRule[] = [
      { mediaType: "image", exclude: ["png"], collections: ["test"] },
    ];
    const content: Block[] = [makeImageBlock("https://example.com/photo.png")];

    await processFiles({
      itemId,
      content,
      fileStore,
      mediaOptimizer,
      transformMedia,
      collection: "test",
    });

    // Rule applies to "test" collection and PNG is excluded → optimizer NOT called
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });
});

describe("processPropertyFiles", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("test", "Test", {});
    db.insert(itemsTable)
      .values({
        id: 1,
        collection: "test",
        changedAt: 1700000000,
      })
      .run();

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

  test("FILE prop gets downloaded and replaced with file id", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyFiles({
      itemId,
      props: { cover: "https://example.com/cover.png", title: "Hello" },
      schema: { cover: PropertyType.FILE, title: PropertyType.STRING },
      fileStore,
      mediaOptimizer,
    });

    expect(result.cover).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);
    expect(result.cover).not.toBe("https://example.com/cover.png");
    expect(result.title).toBe("Hello");
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);
  });

  test("FILES prop (string[]) gets each URL processed", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyFiles({
      itemId,
      props: {
        images: ["https://example.com/a.png", "https://example.com/b.jpg"],
      },
      schema: { images: PropertyType.FILES },
      fileStore,
      mediaOptimizer,
    });

    const images = result.images as string[];
    expect(images).toHaveLength(2);
    expect(images[0]).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);
    expect(images[1]).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(0);
  });

  test("mixed FILE and STRING props process URLs but preserve emoji strings", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();
    const schema = { icon: PropertyType.FILE | PropertyType.STRING | PropertyType.OPTIONAL };

    const image = await processPropertyFiles({
      itemId,
      props: { icon: "https://example.com/icon.png" },
      schema,
      fileStore,
      mediaOptimizer,
    });
    const emoji = await processPropertyFiles({
      itemId,
      props: { icon: "🎉" },
      schema,
      fileStore,
      mediaOptimizer,
    });

    expect(image.icon).toMatch(/^[a-f0-9]{16}\.[a-z0-9]+$/);
    expect(emoji.icon).toBe("🎉");
  });

  test("non-FILE props are untouched", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyFiles({
      itemId,
      props: { title: "Hello", count: 42 },
      schema: { title: PropertyType.STRING, count: PropertyType.NUMBER },
      fileStore,
      mediaOptimizer,
    });

    expect(result.title).toBe("Hello");
    expect(result.count).toBe(42);
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });

  test("null prop values are skipped", async () => {
    const fileStore = makeFileStore();
    const mediaOptimizer = makeMediaOptimizer();

    const result = await processPropertyFiles({
      itemId,
      props: { cover: null },
      schema: { cover: PropertyType.FILE },
      fileStore,
      mediaOptimizer,
    });

    expect(result.cover).toBeNull();
    expect(mediaOptimizer.optimize).not.toHaveBeenCalled();
  });
});
