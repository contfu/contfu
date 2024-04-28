import type { MediaStore } from "@contfu/client";
import { FileStore } from "@contfu/client/src/media/file-store";
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
  optimizer = new SharpOptimizer({ store });
});

describe("optimizeImage()", () => {
  it("should optimize the image into avif by default", async () => {
    await optimizer.optimizeImage(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`)
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
  });

  it("should optimize the image into specified formats", async () => {
    await optimizer.optimizeImage(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      { formats: ["avif", "webp"] }
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it("should optimize the image into specified widths, without upscaling", async () => {
    await optimizer.optimizeImage(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      { widths: [200, 400, 600] } // original is 433px
    );

    expect(store.write).toHaveBeenCalledWith(
      "test/400.avif",
      expect.any(Buffer)
    );
    expect(store.write).toHaveBeenCalledWith(
      "test/200.avif",
      expect.any(Buffer)
    );
  });

  it("should work with input stream", async () => {
    await optimizer.optimizeImage(
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream(),
      { formats: ["avif", "webp"] }
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });

  it.skip("should output files", async () => {
    optimizer = new SharpOptimizer({ store: new FileStore("./.tmp/test-out") });

    await optimizer.optimizeImage(
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream(),
      { formats: ["avif", "webp"], widths: [200, 400, 600] }
    );

    expect(store.write).toHaveBeenCalledWith("test.avif", expect.any(Buffer));
    expect(store.write).toHaveBeenCalledWith("test.webp", expect.any(Buffer));
  });
});
