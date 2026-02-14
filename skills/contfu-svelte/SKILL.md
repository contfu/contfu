---
name: contfu-svelte
description: Write Svelte 5 components for Contfu. Use when creating or modifying Svelte components, working with runes ($state, $derived, $effect, $props), handling forms, or building UI in the SvelteKit app.
---

# Svelte 5 Development

Svelte 5 patterns for the Contfu SvelteKit application.

## Runes (Reactivity Primitives)

### `$state` — Reactive State

```svelte
<script lang="ts">
  let count = $state(0);
  let items = $state<string[]>([]);

  // Objects/arrays are deeply reactive proxies
  let user = $state({ name: 'John', settings: { theme: 'dark' } });
  user.settings.theme = 'light'; // Triggers reactivity
</script>
```

**Variants:**

- `$state.raw()` — Non-deep reactivity (for large objects)
- `$state.snapshot()` — Get static copy of reactive state

### `$derived` — Computed Values

```svelte
<script lang="ts">
  let count = $state(0);

  // Simple expression
  let doubled = $derived(count * 2);

  // Complex computation with $derived.by()
  let summary = $derived.by(() => {
    const items = fetchItems();
    return items.filter(i => i.active).length;
  });
</script>
```

**Rules:**

- Derived values auto-update when dependencies change
- Cannot be mutated directly
- Use `$derived.by()` for multi-line computations

### `$effect` — Side Effects

```svelte
<script lang="ts">
  let count = $state(0);

  // Runs when count changes
  $effect(() => {
    console.log('Count is now:', count);
  });

  // With cleanup
  $effect(() => {
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval); // Cleanup function
  });
</script>
```

**Variants:**

- `$effect.pre()` — Runs before DOM updates
- `$effect.tracking()` — Check if in tracking context

**Rules:**

- Effects track synchronous state access only
- Don't read state in async callbacks if you need reactivity
- Return cleanup functions when needed

### `$props` — Component Props

```svelte
<script lang="ts">
  interface Props {
    name: string;
    count?: number;
    onUpdate?: (value: number) => void;
  }

  let { name, count = 0, onUpdate }: Props = $props();
</script>
```

**With `$bindable` for two-way binding:**

```svelte
<script lang="ts">
  interface Props {
    value?: string;
  }

  let { value = $bindable('') }: Props = $props();
</script>

<!-- Parent can now use bind:value -->
<MyInput bind:value={searchTerm} />
```

### `$inspect` — Debug Logging

```svelte
<script lang="ts">
  let data = $state({ items: [] });

  // Logs when data changes (dev only)
  $inspect(data);

  // With custom callback
  $inspect(data).with((type, value) => {
    console.log(`${type}:`, value);
  });
</script>
```

## Control Flow

### Conditionals

```svelte
{#if condition}
  <p>True</p>
{:else if otherCondition}
  <p>Other</p>
{:else}
  <p>False</p>
{/if}
```

### Loops

```svelte
{#each items as item, index (item.id)}
  <li>{index}: {item.name}</li>
{:else}
  <li>No items</li>
{/each}
```

**Always use keys for lists** — `(item.id)` enables efficient updates.

### Promises

```svelte
{#await promise}
  <LoadingSpinner />
{:then data}
  <DataDisplay {data} />
{:catch error}
  <ErrorMessage message={error.message} />
{/await}
```

### Key Blocks

```svelte
{#key selectedId}
  <!-- Recreates component when selectedId changes -->
  <ItemDetails id={selectedId} />
{/key}
```

## Snippets

Reusable template blocks that replace slots in Svelte 5.

### Defining Snippets

```svelte
{#snippet icon(name: string)}
  <span class="icon icon-{name}"></span>
{/snippet}

<!-- Render with @render -->
{@render icon('check')}
```

### Passing Snippets as Props

```svelte
<!-- Parent -->
<Button>
  {#snippet children()}
    <span>Click me</span>
  {/snippet}
</Button>

<!-- Or implicit children -->
<Button>
  <span>Click me</span>
</Button>
```

```svelte
<!-- Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<button>
  {@render children()}
</button>
```

### Snippet with Arguments (render props pattern)

```svelte
<!-- Parent using child snippet -->
<DropdownMenu.Trigger>
  {#snippet child({ props })}
    <Button {...props}>Open</Button>
  {/snippet}
</DropdownMenu.Trigger>
```

## Special Tags

```svelte
<!-- Raw HTML (sanitize first!) -->
{@html content}

<!-- Local constant in template -->
{@const doubled = count * 2}

<!-- Debug logging -->
{@debug user, count}
```

## Event Handling

Svelte 5 uses native event names with `on` prefix:

```svelte
<button onclick={() => count++}>Click</button>
<input oninput={(e) => name = e.currentTarget.value} />
<form onsubmit|preventDefault={handleSubmit}>
```

**Modifiers:**

- `|preventDefault` — Calls `e.preventDefault()`
- `|stopPropagation` — Stops event bubbling
- `|capture` — Use capture phase

## Data Binding

```svelte
<!-- Input binding -->
<input bind:value={name} />
<input type="checkbox" bind:checked={isActive} />
<input type="file" bind:files={fileList} />

<!-- Select binding -->
<select bind:value={selected}>
  <option value="a">A</option>
</select>

<!-- Element reference -->
<div bind:this={element}></div>

<!-- Dimensions (read-only) -->
<div bind:clientWidth={width} bind:clientHeight={height}></div>
```

## Project Patterns

### Component Props with TypeScript

```svelte
<script lang="ts">
  interface Props {
    sourceId: number;
    value?: string;
    name?: string;
  }

  let { sourceId, value = $bindable(''), name = 'ref' }: Props = $props();
</script>
```

### Namespace Imports for Compound Components

```svelte
<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
</script>

<Alert.Root variant="destructive">
  <Alert.Title>Error</Alert.Title>
  <Alert.Description>Something went wrong</Alert.Description>
</Alert.Root>
```

### Form Handling (svelte-kit-remote-functions)

**Always use this pattern instead of manual fetch().**

```svelte
<script lang="ts">
  import { createItem } from '$lib/remote/items.remote';
</script>

<form method="post" action={createItem.action}>
  <input type="hidden" name="sourceId" value={source.id} />
  <input type="text" name="name" required />

  <Button type="submit" disabled={!!createItem.pending}>
    {createItem.pending ? 'Creating...' : 'Create'}
  </Button>
</form>

<!-- Validation errors -->
{#if createItem.fields?.name?.issues()?.length}
  <p class="text-destructive">
    {createItem.fields?.name?.issues()?.[0]?.message}
  </p>
{/if}
```

### Using `page` State

```svelte
<script lang="ts">
  import { page } from '$app/state';

  // Access params
  const id = Number.parseInt(page.params.id ?? '', 10);

  // Check active route
  const isActive = $derived(page.url.pathname.startsWith('/sources'));
</script>
```

### Async Data in Components

```svelte
<script lang="ts">
  import { getSource } from '$lib/remote/sources.remote';

  const id = Number.parseInt(page.params.id ?? '', 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
</script>

{#if source}
  <!-- Render content -->
{:else}
  <Alert.Root variant="destructive">
    <Alert.Title>Not found</Alert.Title>
  </Alert.Root>
{/if}
```

### Computed Active State

```svelte
<script lang="ts">
  import { page } from '$app/state';

  const isAdmin = $derived(user?.role === UserRole.ADMIN);

  function isActiveLink(href: string): boolean {
    const path = page.url?.pathname ?? '';
    return path.startsWith(href);
  }
</script>
```

## Classes with Reactivity

Use `$state()` in class fields for reactive class instances:

```typescript
class Counter {
  count = $state(0);
  doubled = $derived(this.count * 2);

  increment() {
    this.count++;
  }
}
```

## Best Practices

### Prefer `$derived` over `$effect` where possible

`$effect` should be a last resort. Prefer declarative patterns:

```svelte
<!-- ❌ Avoid: Using $effect for computed values -->
let doubled = $state(0);
$effect(() => {
  doubled = count * 2;
});

<!-- ✅ Better: Use $derived -->
const doubled = $derived(count * 2);
```

### Reactive Queries with Remote Functions

Use the query object pattern with `.current` for reactive data. **Queries auto-refresh after form submissions.**

```svelte
<script lang="ts">
  import { getItems, deleteItem } from '$lib/remote/items.remote';

  // Query object - auto-refreshes after any form submission on the page
  const items = getItems({ collectionId: id });
</script>

<!-- Use query properties in template -->
{#if items.loading}
  <p>Loading...</p>
{:else if items.current.length === 0}
  <p>No items</p>
{:else}
  {#each items.current as item}
    <div>{item.name}</div>
  {/each}
{/if}

<!-- Forms auto-refresh queries - no $effect needed -->
<form {...deleteItem}>
  <button type="submit">Delete</button>
</form>
```

**Key points:**

- `query.current` — the data
- `query.loading` — loading state
- `query.error` — error state
- `query.refresh()` — manual re-fetch (rarely needed, forms auto-refresh)

Queries are cached: `getItems() === getItems()`. Form submissions auto-refresh all queries on the page.

### When `$effect` is appropriate

- Reacting to form submission results (showing success messages, closing dialogs)
- Refreshing queries after mutations
- Side effects that can't be expressed declaratively (DOM manipulation, external APIs)

## Common Mistakes

### Don't: Read state in async callbacks expecting reactivity

```svelte
<!-- Won't react to changes -->
$effect(() => {
  setTimeout(() => {
    console.log(count); // Not tracked
  }, 1000);
});

<!-- Do this instead -->
$effect(() => {
  const currentCount = count; // Track synchronously
  setTimeout(() => {
    console.log(currentCount);
  }, 1000);
});
```

### Don't: Mutate $derived values

```svelte
let doubled = $derived(count * 2);
doubled = 10; // Error! Cannot mutate derived
```

### Don't: Use manual fetch for forms

```svelte
<!-- Don't -->
const response = await fetch('/api/create', { method: 'POST', body: formData });

<!-- Do: Use remote functions -->
<form method="post" action={createItem.action}>
```

### Don't: Forget keys in #each

```svelte
<!-- Bad: No key -->
{#each items as item}

<!-- Good: With key -->
{#each items as item (item.id)}
```

## File Structure

```
src/lib/
├── components/
│   ├── ui/              # shadcn-svelte primitives
│   │   ├── button/
│   │   ├── card/
│   │   └── ...
│   └── *.svelte         # App-specific components
├── remote/              # Form actions (svelte-kit-remote-functions)
│   └── *.remote.ts
└── server/              # Server-only code
```

## Reference

- [Svelte 5 Docs](https://svelte.dev/docs/svelte)
- [SvelteKit Docs](https://svelte.dev/docs/kit)
- [shadcn-svelte](https://next.shadcn-svelte.com/)
