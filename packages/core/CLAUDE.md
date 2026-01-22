# CLAUDE.md - @contfu/core

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/core`
**Version:** 0.1.1
**Purpose:** Shared types and domain interfaces for the entire Contfu platform

This package contains no runtime code—only TypeScript type definitions and interfaces used across all other packages.

## Architecture

### Module Structure

- `src/items.ts` - Item type definition with props and content blocks
- `src/events.ts` - Event types (CONNECTED, CHANGED, DELETED, LIST_IDS, CHECKSUM, ERROR)
- `src/blocks.ts` - Rich content block structures (paragraphs, headings, quotes, code, tables, images, custom blocks)
- `src/collections.ts` - Collection schema with PropertyType enum
- `src/commands.ts` - Command types (CONNECT, ACK)
- `src/sources.ts` - Source pull configuration interfaces for CMS integrations
- `src/index.ts` - Re-exports all modules

### Design Patterns

- **Compact enum-based representation:** Event types use numbers 0-5 for efficient binary serialization
- **PropertyType bitwise operations:** PropertyType enum uses power-of-2 values enabling bitwise operations
- **Binary serialization-friendly:** Data structures use Buffers and number arrays for msgpackr compatibility

### Event Format

Events use a compact array format for WebSocket transmission:

```typescript
[EventType, collection, id, createdAt, changedAt, [ref, props, content?]]
```

## Libraries

| Library    | Version | Purpose       |
| ---------- | ------- | ------------- |
| typescript | ^5.6.3  | Type checking |

## Coding Best Practices

1. **Types only:** This package must contain zero runtime code
2. **Export discipline:** All public types must be re-exported from `src/index.ts`
3. **Serialization awareness:** Design types to be msgpackr-friendly (avoid Maps, Sets, symbols)
4. **Backward compatibility:** Changing type shapes affects all dependent packages
5. **Document enums:** Add JSDoc comments explaining enum value meanings

## Development Process

### Testing

No tests required—this is a types-only package. Type correctness is validated at compile time.

### Commands

```bash
# Type check
bun run tsc --noEmit

# Build (if needed)
bun run build
```

### Making Changes

1. Consider impact on all dependent packages
2. Prefer additive changes over breaking changes
3. Update version if changing public API
4. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- Event types must remain numeric for binary serialization efficiency
- PropertyType values are powers of 2 for bitwise combination support
