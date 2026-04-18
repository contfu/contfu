/* oxlint-disable typescript/unbound-method, typescript/await-thenable -- Bun test mocks and rejected-expect helpers trigger false positives here */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { db } from "../../infra/db/db";
import { mediaVariantTable } from "../../infra/db/schema";
import type { FileData } from "../../infra/types/content-types";
import { truncateAllTables } from "../../../test/setup";
import { createFile } from "./createFile";
import { FileLoadError, loadFile } from "./loadFile";
import type { FileStore } from "../../domain/files";
import type { MediaOptimizer } from "../../domain/media";

const fileId = Buffer.from([1, 2, 3, 4]).toString("base64url");
const sourceData = Buffer.from("source-image-data");

function createTestFile(): FileData {
  return {
    id: fileId,
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

describe("loadFile", () => {
  beforeEach(() => {
    truncateAllTables();
    createFile(createTestFile());
  });

  test("loads, converts, and streams an file", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${fileId}.avif`,
            ext: "avif",
            size: 3,
            data: Buffer.from("out"),
          },
        ]),
      ),
    };

    const stream = await loadFile(
      `${fileId}.avif`,
      { resize: { width: 100 } },
      { fileStore, mediaOptimizer },
    );

    expect(await streamToBuffer(stream)).toEqual(Buffer.from("out"));
    expect(fileStore.read).toHaveBeenCalledWith(`${fileId}.png`);
    expect(mediaOptimizer.optimize).toHaveBeenCalledWith(
      `${fileId}.png`,
      sourceData,
      "image",
      expect.objectContaining({ avif: [[100, undefined, undefined]] }),
    );
  });

  test("rejects invalid file paths", async () => {
    await expect(loadFile(fileId, {}, {})).rejects.toEqual(
      new FileLoadError("File path must end with <id>.<media-ext>", 400),
    );
  });

  test("rejects unsupported extensions", async () => {
    await expect(loadFile(`${fileId}.txt`, {}, {})).rejects.toEqual(
      new FileLoadError("Unsupported media extension: txt", 400),
    );
  });

  test("returns cached variants without re-optimizing", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${fileId}.avif`,
            ext: "avif",
            size: 6,
            data: Buffer.from("cached"),
          },
        ]),
      ),
    };

    const first = await loadFile(
      `${fileId}.avif`,
      { resize: { width: 320 } },
      { fileStore, mediaOptimizer, cache: true },
    );
    expect(await streamToBuffer(first)).toEqual(Buffer.from("cached"));
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    const second = await loadFile(
      `${fileId}.avif`,
      { resize: { width: 320 } },
      { fileStore, mediaOptimizer, cache: true },
    );
    expect(await streamToBuffer(second)).toEqual(Buffer.from("cached"));
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);

    const variants = db.select().from(mediaVariantTable).all();
    expect(variants).toHaveLength(1);
  });

  test("skips cache writes when disabled", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(sourceData)),
      exists: mock(() => Promise.resolve(true)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() =>
        Promise.resolve([
          {
            path: `${fileId}.avif`,
            ext: "avif",
            size: 2,
            data: Buffer.from("ok"),
          },
        ]),
      ),
    };

    await loadFile(`${fileId}.avif`, {}, { fileStore, mediaOptimizer, cache: false });

    expect(db.select().from(mediaVariantTable).all()).toHaveLength(0);
  });

  test("fails when the source file is missing from the store", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() => Promise.resolve([])),
    };

    await expect(loadFile(`${fileId}.avif`, {}, { fileStore, mediaOptimizer })).rejects.toEqual(
      new FileLoadError("Not found", 404),
    );
  });
});
