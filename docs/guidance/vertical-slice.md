# Vertical Slice Architecture

Load this when creating new features or understanding the code structure.

## Rules

1. **One function per file** - Each feature function gets its own file
2. **No re-exports** - App imports directly from `@contfu/svc-backend/...`
3. **Domain types** - Features return DTOs from `domain/types.ts`, not DB types
4. **No credential exposure** - Sensitive data never exposed to app layer

## Feature Structure

```
features/
  sources/
    createSource.ts      # export async function createSource(...)
    deleteSource.ts
    getSource.ts
    listSources.ts
```

## Imports in App

```ts
// ✅ Correct - direct import
import { createSource } from "@contfu/svc-backend/features/sources/createSource";

// ❌ Wrong - re-export
import { createSource } from "$lib/server/sources";
```

## Domain Types

Types shared across features belong in `@contfu/core`:

```ts
// ✅ Correct - in packages/core/src/incidents.ts
export const IncidentType = { SchemaIncompatible: 1, FilterInvalid: 2 } as const;

// ❌ Wrong - in feature file
export type IncidentType = "schema_incompatible" | "filter_invalid";
```

## Enums

Use **const objects** instead of TypeScript enums or string unions:

```ts
// ✅ Correct
export const IncidentType = {
  SchemaIncompatible: 1,
  FilterInvalid: 2,
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

// ❌ Wrong
export type IncidentType = "schema_incompatible" | "filter_invalid";
```

## SvelteKit Data Loading

**Don't use `+page.server.ts` for data loading** — use remote functions:

```ts
// ✅ Correct - remote function in +page.svelte
import { getCollection } from "$lib/server/features/collections/getCollection";
const collection = await getCollection(userId, collectionId);

// ❌ Wrong - +page.server.ts load function
export const load = async ({ params }) => { ... };
```

For mutations, use form actions with `<form method="POST">`.
