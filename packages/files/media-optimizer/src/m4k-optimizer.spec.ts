import { beforeEach, describe, expect, it } from "bun:test";
import { open, readFile } from "node:fs/promises";
import { M4kOptimizer } from "./m4k-optimizer";

let optimizer: M4kOptimizer;

beforeEach(() => {
  optimizer = new M4kOptimizer();
});

describe("optimize() — images", () => {
  it("should optimize the image into avif by default", async () => {
    const results = await optimizer.optimize(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.avif");
    expect(results[0].data).toBeInstanceOf(Buffer);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("should optimize the image into specified formats", async () => {
    const results = await optimizer.optimize(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toEqual(["test.avif", "test.webp"]);
    for (const r of results) {
      expect(r.data).toBeInstanceOf(Buffer);
      expect(r.data.byteLength).toBeGreaterThan(0);
    }
  });

  it("should optimize the image into specified widths", async () => {
    const results = await optimizer.optimize(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { avif: [200, 400, 600] }, // original is 433px
    );

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.path)).toEqual([
      "test/w200.avif",
      "test/w400.avif",
      "test/w600.avif",
    ]);
  });

  it("should work with input stream", async () => {
    const results = await optimizer.optimize(
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toEqual(["test.avif", "test.webp"]);
  });

  it("should accept AVIF buffer input", async () => {
    const results = await optimizer.optimize(
      "test.avif",
      await readFile(`${__dirname}/__fixtures__/test-image.avif`),
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toEqual(["test.avif", "test.webp"]);
    for (const r of results) {
      expect(r.data).toBeInstanceOf(Buffer);
      expect(r.data.byteLength).toBeGreaterThan(0);
    }
  });

  it("should accept AVIF stream input", async () => {
    const results = await optimizer.optimize(
      "test.avif",
      (
        await open(`${__dirname}/__fixtures__/test-image.avif`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[]], webp: [[]] },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toEqual(["test.avif", "test.webp"]);
  });

  it("should accept 10-bit AVIF buffer input (no-op passthrough)", async () => {
    const input = await readFile(`${__dirname}/__fixtures__/test-image-10bit.avif`);
    const results = await optimizer.optimize("test.avif", input, "image", { avif: [[]] });

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.avif");
    expect(results[0].data).toBeInstanceOf(Buffer);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("should accept 10-bit AVIF stream input (no-op passthrough)", async () => {
    const results = await optimizer.optimize(
      "test.avif",
      (
        await open(`${__dirname}/__fixtures__/test-image-10bit.avif`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[]] },
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.avif");
  });

  it("should output files via returned buffers", async () => {
    const results = await optimizer.optimize(
      "test.png",
      (
        await open(`${__dirname}/__fixtures__/test-image.png`)
      ).readableWebStream() as ReadableStream,
      "image",
      { avif: [[200, undefined, 5], [400, 100], 600], webp: [200, 400, 600] },
    );

    expect(results).toHaveLength(6);
    expect(results.map((r) => r.path)).toEqual([
      "test/w200.avif",
      "test/w400h100.avif",
      "test/w600.avif",
      "test/w200.webp",
      "test/w400.webp",
      "test/w600.webp",
    ]);

    // Verify all results have buffer data
    for (const r of results) {
      expect(r.data).toBeInstanceOf(Buffer);
      expect(r.data.byteLength).toBe(r.size);
    }

    const store = new Map<string, Buffer>();
    for (const r of results) {
      store.set(r.path, r.data);
    }
    expect(store.has("test/w200.avif")).toBe(true);
    expect(store.has("test/w400h100.avif")).toBe(true);
    expect(store.has("test/w600.avif")).toBe(true);
    expect(store.has("test/w200.webp")).toBe(true);
    expect(store.has("test/w400.webp")).toBe(true);
    expect(store.has("test/w600.webp")).toBe(true);
  });
});
