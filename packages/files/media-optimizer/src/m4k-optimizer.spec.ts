import { beforeEach, describe, expect, it } from "bun:test";
import { open, readFile } from "node:fs/promises";
import {
  M4kOptimizer,
  createTransform,
  toM4kAudioOptions,
  toM4kImageOptions,
  toM4kVideoOptions,
} from "./m4k-optimizer";

let optimizer: M4kOptimizer;

async function withFileStream<T>(
  path: string,
  callback: (stream: ReadableStream) => Promise<T>,
): Promise<T> {
  const file = await open(path);
  try {
    return await callback(file.readableWebStream() as ReadableStream);
  } finally {
    await file.close();
  }
}

beforeEach(() => {
  optimizer = new M4kOptimizer();
});

describe("option mapping", () => {
  it("forwards on-demand image conversion options to m4k", () => {
    expect(
      toM4kImageOptions({
        mediaType: "image",
        format: "webp",
        ext: "png",
        quality: 70,
        resize: { width: 320, height: 180, fit: "cover" },
        rotate: 90,
        crop: { left: 1, top: 2, width: 3, height: 4 },
        keepMetadata: true,
        keepExif: true,
        keepIcc: true,
        colorspace: "srgb",
      }),
    ).toEqual({
      format: "webp",
      ext: "png",
      quality: 70,
      resize: { width: 320, height: 180, fit: "cover" },
      rotate: 90,
      crop: { left: 1, top: 2, width: 3, height: 4 },
      keepMetadata: true,
      keepExif: true,
      keepIcc: true,
      colorspace: "srgb",
    });
  });

  it("forwards full video and audio conversion options to m4k", () => {
    expect(
      toM4kVideoOptions({
        mediaType: "video",
        format: "mp4",
        ext: "m4v",
        videoCodec: "libx264",
        videoBitrate: "1000k",
        videoFilters: "scale=320:-1",
        audioCodec: "aac",
        audioBitrate: "128k",
        audioFilters: "volume=0.5",
        fps: 24,
        width: 320,
        height: 180,
        aspect: "16:9",
        frames: 10,
        duration: "3",
        seek: "1",
        inputFormat: "mov",
        pad: "ceil(iw/2)*2:ceil(ih/2)*2",
        complexFilters: "[0:v]scale=320:-1[v]",
        args: ["-movflags", "faststart"],
      }),
    ).toEqual({
      format: "mp4",
      ext: "m4v",
      videoCodec: "libx264",
      videoBitrate: "1000k",
      videoFilters: "scale=320:-1",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioFilters: "volume=0.5",
      fps: 24,
      size: "320x180",
      aspect: "16:9",
      frames: 10,
      duration: "3",
      seek: "1",
      inputFormat: "mov",
      pad: "ceil(iw/2)*2:ceil(ih/2)*2",
      complexFilters: "[0:v]scale=320:-1[v]",
      args: ["-movflags", "faststart"],
    });

    expect(
      toM4kAudioOptions({
        mediaType: "audio",
        format: "mp3",
        ext: "mpga",
        codec: "libmp3lame",
        bitrate: "128k",
        filters: "volume=0.5",
        complexFilters: "[0:a]anull[a]",
        duration: "3",
        seek: "1",
        inputFormat: "wav",
        args: ["-ac", "1"],
      }),
    ).toEqual({
      format: "mp3",
      ext: "mpga",
      codec: "libmp3lame",
      bitrate: "128k",
      filters: "volume=0.5",
      complexFilters: "[0:a]anull[a]",
      duration: "3",
      seek: "1",
      inputFormat: "wav",
      args: ["-ac", "1"],
    });
  });
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
    const results = await withFileStream(`${__dirname}/__fixtures__/test-image.png`, (stream) =>
      optimizer.optimize("test.png", stream, "image", { avif: [[]], webp: [[]] }),
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
    const results = await withFileStream(`${__dirname}/__fixtures__/test-image.avif`, (stream) =>
      optimizer.optimize("test.avif", stream, "image", { avif: [[]], webp: [[]] }),
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
    const results = await withFileStream(
      `${__dirname}/__fixtures__/test-image-10bit.avif`,
      (stream) => optimizer.optimize("test.avif", stream, "image", { avif: [[]] }),
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.avif");
  });

  it("uses Bun.Image for supported PNG to WebP variants when available", async () => {
    const results = await optimizer.optimize(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { webp: [[]] },
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.webp");
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("falls back to m4k for AVIF input even when output is Bun.Image encodable", async () => {
    const results = await optimizer.optimize(
      "test.avif",
      await readFile(`${__dirname}/__fixtures__/test-image.avif`),
      "image",
      { webp: [[]] },
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.webp");
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("falls back to m4k for GIF and BMP output because Bun.Image only decodes them", async () => {
    const results = await optimizer.optimize(
      "test.png",
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      "image",
      { gif: [[]] },
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("test.gif");
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("uses Bun.Image for supported createTransform image conversions when available", async () => {
    const output = await createTransform()(
      await readFile(`${__dirname}/__fixtures__/test-image.png`),
      {
        mediaType: "image",
        format: "webp",
        resize: { width: 20 },
      },
    );

    expect(output.byteLength).toBeGreaterThan(0);
  });

  it("should output files via returned buffers", async () => {
    const results = await withFileStream(`${__dirname}/__fixtures__/test-image.png`, (stream) =>
      optimizer.optimize("test.png", stream, "image", {
        avif: [[200, undefined, 5], [400, 100], 600],
        webp: [200, 400, 600],
      }),
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
