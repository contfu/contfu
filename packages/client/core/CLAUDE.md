# CLAUDE.md - @contfu/client-core

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/client-core`
**Version:** 0.1.1
**Purpose:** Client-side database utilities and media management interfaces

This package provides shared interfaces and types for client-side storage operations.

## Architecture

### Module Structure

- `src/items.ts` - PageLink type (path, title, description, props)
- `src/media.ts` - MediaStore and MediaOptimizer interfaces
- `src/index.ts` - Re-exports

### Key Interfaces

**MediaStore:** File storage abstraction

```typescript
interface MediaStore {
  exists(path: string): Promise<boolean>;
  write(path: string, data: Buffer | ReadableStream): Promise<void>;
  read(path: string): Promise<Buffer>;
}
```

**MediaOptimizer:** Image optimization abstraction

```typescript
interface MediaOptimizer {
  optimize(input: Buffer | ReadableStream, opts: OptimizeImageOpts): Promise<void>;
}
```

**Image Formats:** avif, webp, jpeg, png

### Design Patterns

- **Interface-based:** Defines contracts, not implementations
- **Pluggable storage:** MediaStore can be implemented for different backends
- **Stream support:** Both Buffer and ReadableStream inputs supported

## Libraries

| Library           | Version | Purpose                     |
| ----------------- | ------- | --------------------------- |
| kysely            | ^0.27.4 | SQL query builder           |
| kysely-bun-worker | ^0.6.3  | Bun-specific Kysely adapter |
| ts-essentials     | ^10.0.2 | TypeScript utilities        |
| typescript        | ^5.6.3  | Type checking (peer)        |

## Coding Best Practices

1. **Interface-first:** Define interfaces before implementations
2. **Stream compatibility:** Support both Buffer and ReadableStream
3. **Format flexibility:** Allow multiple image formats in optimization
4. **Kysely patterns:** Use Kysely's type-safe query building

## Development Process

### Testing

No unit tests—this package defines interfaces only. Tests are in implementing packages:

- `@contfu/bun-file-store` - MediaStore implementation tests
- `@contfu/media-optimizer` - MediaOptimizer implementation tests

### Commands

```bash
# Type check
bun run tsc --noEmit
```

### Making Changes

1. Consider impact on implementing packages
2. Maintain backward compatibility for interfaces
3. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- Interfaces should support both sync (Buffer) and async (ReadableStream) inputs
- Keep interfaces minimal to allow flexible implementations
- Kysely provides excellent TypeScript inference for database operations
