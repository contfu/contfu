import { FileStore } from "@contfu/bun-file-store";
import type { MediaStore } from "contfu";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { open, readFile } from "node:fs/promises";
import { M4kOptimizer } from "./m4k-optimizer";

const store = {
  exists: mock(),
  read: mock(),
  write: mock(),
} satisfies MediaStore;

let optimizer: M4kOptimizer;

beforeEach(() => {
  optimizer = new M4kOptimizer();
  store.write.mockClear();
});

describe("optimize() — images", () => {
  it("should optimize the image into avif by default", async () => {
    await optimizer.optimize(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
  });

  it("should optimize the image into specified formats", async () => {
    await optimizer.optimize(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it("should optimize the image into specified widths", async () => {
    await optimizer.optimize(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { avif: [200, 400, 600] }, // original is 433px
    );

    expect(store.write).toHaveBeenCalledWith("test/w200.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test/w400.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test/w600.avif", expect.any(Buffer));
  });

  it("should work with input stream", async () => {
    await optimizer.optimize(
      store,
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it("should output files", async () => {
    const store = new FileStore("./.tmp/test-out");
    optimizer = new M4kOptimizer();

    await optimizer.optimize(
      store,
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[200, undefined, 5], [400, 100], 600], webp: [200, 400, 600] },
    );

    expect(await store.exists("test/w200.avif")).toBe(true);
    expect(await store.exists("test/w400h100.avif")).toBe(true);
    expect(await store.exists("test/w600.avif")).toBe(true);
    expect(await store.exists("test/w200.webp")).toBe(true);
    expect(await store.exists("test/w400.webp")).toBe(true);
    expect(await store.exists("test/w600.webp")).toBe(true);
  });
});
