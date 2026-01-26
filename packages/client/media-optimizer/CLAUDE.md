# CLAUDE.md - @contfu/media-optimizer

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/media-optimizer`
**Version:** 0.1.0
**Purpose:** Image optimization using Sharp, implementing the MediaOptimizer interface

This package provides responsive image generation with multiple formats and sizes.

## Architecture

### Module Structure

- `src/sharp-optimizer.ts` - SharpOptimizer class implementing MediaOptimizer
- `src/sharp-optimizer.spec.ts` - Test suite
- `src/__fixtures__/test-image.png` - Test image fixture
- `src/index.ts` - Exports

### SharpOptimizer Implementation

```typescript
class SharpOptimizer implements MediaOptimizer {
  constructor(store: MediaStore);

  optimize(input: Buffer | ReadableStream, opts: OptimizeImageOpts): Promise<void>;
}
```

### Key Features

- **Multiple formats:** avif, webp, jpeg, png
- **Responsive widths:** Generate multiple size variants (e.g., 200, 400, 600px)
- **Parallel processing:** Uses Sharp's `clone()` for concurrent transformations
- **Format detection:** Automatic format detection from filename
- **Quality control:** Per-format quality settings

### Data Flow

1. Accept image input (Buffer or ReadableStream)
2. Create Sharp instance from input
3. Clone for each output specification
4. Apply resize and format transformations in parallel
5. Write results to MediaStore

## Libraries

| Library                | Version      | Purpose                        |
| ---------------------- | ------------ | ------------------------------ |
| sharp                  | ^0.33.5      | Image processing               |
| @contfu/client         | workspace:\* | MediaOptimizer interface (dev) |
| @contfu/bun-file-store | workspace:\* | MediaStore for tests (dev)     |
| @types/bun             | \*           | Bun type definitions (dev)     |

## Coding Best Practices

1. **Clone for parallel:** Use `sharp.clone()` to process multiple outputs from one input
2. **Stream support:** Accept ReadableStream for memory-efficient large images
3. **Format flexibility:** Support all modern image formats
4. **Quality tradeoffs:** Use appropriate quality settings per format (avif: lower quality OK, jpeg: needs higher)

## Development Process

### Testing

Tests use Bun's built-in test framework with mocking and real file I/O.

```bash
# Run tests
bun test

# Run specific test file
bun test src/sharp-optimizer.spec.ts
```

**Test patterns:**

- Mock MediaStore for unit tests
- Real file output tests in `./.tmp/test-out`
- Tests cover: default optimization, multiple formats, responsive widths, ReadableStream input

### Commands

```bash
# Run tests
bun test

# Build
bun run build

# Type check
bun run tsc --noEmit
```

### Making Changes

1. Ensure tests pass: `bun test`
2. Test with various image formats and sizes
3. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- Sharp's `clone()` is essential for parallel processing without re-reading the source
- AVIF provides best compression but is slowest to encode
- WebP is a good balance of compression and encoding speed
- ReadableStream must be fully consumed before Sharp can process
