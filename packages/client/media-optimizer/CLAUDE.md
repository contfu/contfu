# CLAUDE.md - @contfu/media-optimizer

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/media-optimizer`
**Version:** 0.0.1
**Purpose:** Unified media optimization using m4k (Sharp for images, FFmpeg for audio/video), implementing the MediaOptimizer interface

This package provides responsive image generation with multiple formats and sizes, plus audio and video transcoding.

## Architecture

### Module Structure

- `src/m4k-optimizer.ts` - M4kOptimizer class implementing MediaOptimizer
- `src/m4k-optimizer.spec.ts` - Test suite
- `src/__fixtures__/test-image.png` - Test image fixture
- `src/index.ts` - Exports

### M4kOptimizer Implementation

```typescript
class M4kOptimizer implements MediaOptimizer {
  optimize(store, canonical, input, mediaType, opts?): Promise<VariantResult[]>;
  optimizeImage(store, canonical, input, opts?): Promise<VariantResult[]>; // backward compat
}
```

### Key Features

- **Image:** Multiple formats (avif, webp, jpeg, png), responsive widths, quality control via m4k/Sharp
- **Video:** Transcode to mp4/webm/mov with configurable codec, bitrate, resolution, fps via m4k/FFmpeg
- **Audio:** Transcode to mp3/aac/ogg/flac/wav/opus with configurable codec and bitrate via m4k/FFmpeg
- **Unified API:** Single `optimize()` method dispatches by `mediaType`
- **On-demand transform:** `createTransform()` for on-demand conversion in `convertMedia()`

### Data Flow

1. Accept media input (Buffer or ReadableStream)
2. Route to `processImage` / `processVideo` / `processAudio` from m4k
3. Iterate async iterable, collect `ProcessedFile` chunks into Buffer
4. Write each output to MediaStore, return `VariantResult[]`

## Libraries

| Library                  | Version   | Purpose                        |
| ------------------------ | --------- | ------------------------------ |
| m4k                      | ^0.2.4    | Unified media processing       |
| sharp                    | ^0.34.5   | Image processing (m4k peer)    |
| tasque                   | ^0.1.2    | Queue management (m4k runtime) |
| @ffmpeg-installer/ffmpeg | ^1.1.0    | FFmpeg binary (m4k runtime)    |
| @contfu/bun-file-store   | workspace | MediaStore for tests (dev)     |
| contfu                   | workspace | MediaOptimizer interface (dev) |

## Development Process

### Testing

```bash
bun test
bun test src/m4k-optimizer.spec.ts
```

**Test patterns:**

- Mock MediaStore for unit tests
- Real file output tests in `./.tmp/test-out`
- Tests cover: default optimization, multiple formats, responsive widths, ReadableStream input, backward compat

### Making Changes

1. Ensure tests pass: `bun test`
2. Test with various media types
3. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- m4k's `processImage`/`processAudio`/`processVideo` return async iterables yielding `ProcessedFile` and progress objects
- `ProcessedFile.stream` is an `AsyncIterable<Uint8Array>` that must be collected into a Buffer
- m4k lists `tasque` and `@ffmpeg-installer/ffmpeg` as devDependencies but they're needed at runtime — add them explicitly
- AVIF provides best compression but is slowest to encode
- FFmpeg is required in the runtime environment for audio/video processing
