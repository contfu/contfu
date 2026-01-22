# CLAUDE.md - @contfu/bun-file-store

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/bun-file-store`
**Version:** 0.1.0
**Purpose:** File storage implementation for Bun runtime using the MediaStore interface

This package provides a filesystem-based implementation of the MediaStore interface optimized for Bun.

## Architecture

### Module Structure

- `src/file-store.ts` - FileStore class implementing MediaStore interface
- `src/file-store.spec.ts` - Test suite
- `src/__fixtures__/` - Test fixtures
- `src/index.ts` - Exports

### FileStore Implementation

```typescript
class FileStore implements MediaStore {
  constructor(basePath: string);

  exists(path: string): Promise<boolean>; // Uses Bun.file().exists()
  write(path: string, data: Buffer | ReadableStream): Promise<void>; // Uses Bun.write()
  read(path: string): Promise<Buffer>; // Uses Bun.file().arrayBuffer()
}
```

### Design Patterns

- **Adapter pattern:** Wraps Bun file APIs to MediaStore interface
- **Path resolution:** Uses Node.js `path.join()` for safe path building
- **Async by default:** All operations return Promises

## Libraries

| Library             | Version      | Purpose                     |
| ------------------- | ------------ | --------------------------- |
| sharp               | ^0.33.5      | Image processing (declared) |
| @contfu/client-core | workspace:\* | MediaStore interface (dev)  |
| @types/bun          | \*           | Bun type definitions (dev)  |

## Coding Best Practices

1. **Use Bun APIs:** Prefer `Bun.file()` and `Bun.write()` over Node.js fs
2. **Path safety:** Always use `path.join()` to prevent path traversal
3. **Stream handling:** Support ReadableStream for large file writes
4. **Error handling:** Let Bun's native errors propagate with context

## Development Process

### Testing

Tests use Bun's built-in test framework with filesystem isolation.

```bash
# Run tests
bun test

# Run specific test file
bun test src/file-store.spec.ts
```

**Test patterns:**

- `beforeEach` cleanup using `fs/promises.rm()`
- Temporary test directory: `/tmp/contfu-test`
- Tests cover: `exists()`, `write()`, `read()` methods

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
2. Test with real file operations
3. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- `Bun.file().exists()` is faster than `fs.existsSync()`
- `Bun.write()` handles both Buffer and ReadableStream efficiently
- Always clean up test directories in `beforeEach` to avoid test pollution
