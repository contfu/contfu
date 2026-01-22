import { FileStore } from "@contfu/bun-file-store";
import { MediaStore } from "@contfu/client-core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { open, readFile } from "fs/promises";
import { SharpOptimizer } from "./sharp-optimizer";

const store = {
  exists: mock(),
  read: mock(),
  write: mock(),
} satisfies MediaStore;

let optimizer: SharpOptimizer;

beforeEach(() => {
  optimizer = new SharpOptimizer();
});

describe("optimizeImage()", () => {
  it("should optimize the image into avif by default", async () => {
    await optimizer.optimizeImage(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
  });

  it("should optimize the image into specified formats", async () => {
    await optimizer.optimizeImage(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      { avif: [[]], webp: [[]] },
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it("should optimize the image into specified widths", async () => {
    await optimizer.optimizeImage(
      store,
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      { avif: [200, 400, 600] }, // original is 433px
    );

    expect(store.write).toHaveBeenCalledWith("test/w200.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test/w400.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test/w600.avif", expect.any(Buffer));
  });

  it("should work with input stream", async () => {
    await optimizer.optimizeImage(
      store,
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
      { avif: [[]], webp: [[]] },
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it("should output files", async () => {
    const store = new FileStore("./.tmp/test-out");
    optimizer = new SharpOptimizer();

    await optimizer.optimizeImage(
      store,
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
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
