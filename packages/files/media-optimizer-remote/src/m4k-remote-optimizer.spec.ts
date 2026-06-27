import { beforeEach, describe, expect, it, mock } from "bun:test";

let lastImageHost: string | undefined;
let lastImageOptions: unknown;
let lastVideoOptions: unknown;
let lastAudioOptions: unknown;

async function* createMockStream() {
  await Promise.resolve();
  yield new Uint8Array([1, 2, 3]);
}

async function* createMockProcessedFileStream() {
  await Promise.resolve();
  yield new MockProcessedFile();
}

class MockProcessedFile {
  stream = createMockStream();
}

await mock.module("@m4k/client", () => ({
  ProcessedFile: MockProcessedFile,
  processImage: (host: string, _input: AsyncIterable<Uint8Array>, options: unknown) => {
    lastImageHost = host;
    lastImageOptions = options;
    return createMockProcessedFileStream();
  },
  processAudio: (_host: string, _input: AsyncIterable<Uint8Array>, options: unknown) => {
    lastAudioOptions = options;
    return createMockProcessedFileStream();
  },
  processVideo: (_host: string, _input: AsyncIterable<Uint8Array>, options: unknown) => {
    lastVideoOptions = options;
    return createMockProcessedFileStream();
  },
}));

beforeEach(() => {
  lastImageHost = undefined;
  lastImageOptions = undefined;
  lastVideoOptions = undefined;
  lastAudioOptions = undefined;
});

const { M4kRemoteOptimizer, createTransform } = await import("./m4k-remote-optimizer");

type OptimizerWithHost = { host: string };

describe("M4kRemoteOptimizer", () => {
  it("accepts the documented url options object", () => {
    const optimizer = new M4kRemoteOptimizer({ url: "http://m4k:8080" });

    expect((optimizer as unknown as OptimizerWithHost).host).toBe("http://m4k:8080");
  });

  it("keeps accepting the string host shorthand", () => {
    const optimizer = new M4kRemoteOptimizer("http://m4k:8080");

    expect((optimizer as unknown as OptimizerWithHost).host).toBe("http://m4k:8080");
  });

  it("accepts the url options object for on-demand transforms", async () => {
    const transform = createTransform({ url: "http://m4k:8080" });

    const output = await transform(Buffer.from([0]), { mediaType: "image", format: "webp" });

    expect(output).toEqual(Buffer.from([1, 2, 3]));
    expect(lastImageHost).toBe("http://m4k:8080");
  });

  it("forwards full image, video, and audio options to remote on-demand transforms", async () => {
    const transform = createTransform({ url: "http://m4k:8080" });

    await transform(Buffer.from([0]), {
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
    });
    expect(lastImageOptions).toEqual({
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

    await transform(Buffer.from([0]), {
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
    });
    expect(lastVideoOptions).toEqual({
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

    await transform(Buffer.from([0]), {
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
    });
    expect(lastAudioOptions).toEqual({
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

  it("applies sync-time base image options and full audio/video options in remote optimizer mode", async () => {
    const optimizer = new M4kRemoteOptimizer({ url: "http://m4k:8080" });

    await optimizer.optimize("test.png", Buffer.from([0]), "image", {
      base: { rotate: 90, keepMetadata: true, colorspace: "srgb" },
      webp: [[320, 180, 70]],
    });
    expect(lastImageOptions).toEqual([
      {
        rotate: 90,
        keepMetadata: true,
        colorspace: "srgb",
        format: "webp",
        ext: "webp",
        quality: 70,
        resize: { width: 320, height: 180, fit: "inside" },
      },
    ]);

    const videoResults = await optimizer.optimize("test.mov", Buffer.from([0]), "video", {
      format: "mp4",
      ext: "m4v",
      videoFilters: "scale=320:-1",
      audioFilters: "volume=0.5",
      duration: "3",
      args: ["-movflags", "faststart"],
    });
    expect(lastVideoOptions).toMatchObject({
      format: "mp4",
      ext: "m4v",
      videoFilters: "scale=320:-1",
      audioFilters: "volume=0.5",
      duration: "3",
      args: ["-movflags", "faststart"],
    });

    expect(videoResults[0]?.path).toBe("test.m4v");
    expect(videoResults[0]?.ext).toBe("m4v");

    const audioResults = await optimizer.optimize("test.wav", Buffer.from([0]), "audio", {
      format: "mp3",
      ext: "mpga",
      filters: "volume=0.5",
      complexFilters: "[0:a]anull[a]",
      duration: "3",
      args: ["-ac", "1"],
    });
    expect(lastAudioOptions).toMatchObject({
      format: "mp3",
      ext: "mpga",
      filters: "volume=0.5",
      complexFilters: "[0:a]anull[a]",
      duration: "3",
      args: ["-ac", "1"],
    });
    expect(audioResults[0]?.path).toBe("test.mpga");
    expect(audioResults[0]?.ext).toBe("mpga");
  });
});
