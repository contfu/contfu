---
name: svelte-core-bestpractices
description: Guidance on writing fast, robust, modern Svelte code. Load this skill whenever in a Svelte project and asked to write/edit or analyze a Svelte component or module. Covers reactivity, event handling, styling, integration with libraries and more.
model: sonnet
---

## `$state`

Only use the `$state` rune for variables that should be _reactive_ — in other words, variables that cause an `$effect`, `$derived` or template expression to update. Everything else can be a normal variable.

Objects and arrays (`$state({...})` or `$state([...])`) are made deeply reactive, meaning mutation will trigger updates. This has a trade-off: in exchange for fine-grained reactivity, the objects must be proxied, which has performance overhead. In cases where you're dealing with large objects that are only ever reassigned (rather than mutated), use `$state.raw` instead. This is often the case with API responses, for example.

## `$derived`

To compute something from state, use `$derived` rather than `$effect`:

```js
// do this
let square = $derived(num * num);

// don't do this
let square;

$effect(() => {
  square = num * num;
});
```

> [!NOTE] `$derived` is given an expression, _not_ a function. If you need to use a function (because the expression is complex, for example) use `$derived.by`.

Deriveds are writable — you can assign to them, just like `$state`, except that they will re-evaluate when their expression changes.

If the derived expression is an object or array, it will be returned as-is — it is _not_ made deeply reactive. You can, however, use `$state` inside `$derived.by` in the rare cases that you need this.

## `$effect`

Effects are an escape hatch and should mostly be avoided. In particular, avoid updating state inside effects.

- If you need to sync state to an external library such as D3, it is often neater to use [`{@attach ...}`](references/@attach.md)
- If you need to run some code in response to user interaction, put the code directly in an event handler or use a [function binding](references/bind.md) as appropriate
- If you need to log values for debugging purposes, use [`$inspect`](references/$inspect.md)
- If you need to observe something external to Svelte, use [`createSubscriber`](references/svelte-reactivity.md)

Never wrap the contents of an effect in `if (browser) {...}` or similar — effects do not run on the server.

## `$props`

Treat props as though they will change. For example, values that depend on props should usually use `$derived`:

```js
// @errors: 2451
let { type } = $props();

// do this
let color = $derived(type === "danger" ? "red" : "green");

// don't do this — `color` will not update if `type` changes
let color = type === "danger" ? "red" : "green";
```

## `$inspect.trace`

`$inspect.trace` is a debugging tool for reactivity. If something is not updating properly or running more than it should you can add `$inspect.trace(label)` as the first line of an `$effect` or `$derived.by` (or any function they call) to trace their dependencies and discover which one triggered an update.

## Events

Any element attribute starting with `on` is treated as an event listener:

```svelte
<button onclick={() => {...}}>click me</button>

<!-- attribute shorthand also works -->
<button {onclick}>...</button>

<!-- so do spread attributes -->
<button {...props}>...</button>
```

If you need to attach listeners to `window` or `document` you can use `<svelte:window>` and `<svelte:document>`:

```svelte
<svelte:window onkeydown={...} />
<svelte:document onvisibilitychange={...} />
```

Avoid using `onMount` or `$effect` for this.

## Snippets

[Snippets](references/snippet.md) are a way to define reusable chunks of markup that can be instantiated with the [`{@render ...}`](references/@render.md) tag, or passed to components as props. They must be declared within the template.

```svelte
{#snippet greeting(name)}
	<p>hello {name}!</p>
{/snippet}

{@render greeting('world')}
```

> [!NOTE] Snippets declared at the top level of a component (i.e. not inside elements or blocks) can be referenced inside `<script>`. A snippet that doesn't reference component state is also available in a `<script module>`, in which case it can be exported for use by other components.

## Each blocks

Prefer to use [keyed each blocks](references/each.md) — this improves performance by allowing Svelte to surgically insert or remove items rather than updating the DOM belonging to existing items.

> [!NOTE] The key _must_ uniquely identify the object. Do not use the index as a key.

Avoid destructuring if you need to mutate the item (with something like `bind:value={item.count}`, for example).

## Using JavaScript variables in CSS

If you have a JS variable that you want to use inside CSS you can set a CSS custom property with the `style:` directive.

```svelte
<div style:--columns={columns}>...</div>
```

You can then reference `var(--columns)` inside the component's `<style>`.

## Styling child components

The CSS in a component's `<style>` is scoped to that component. If a parent component needs to control the child's styles, the preferred way is to use CSS custom properties:

```svelte
<!-- Parent.svelte -->
<Child --color="red" />

<!-- Child.svelte -->
<h1>Hello</h1>

<style>
	h1 {
		color: var(--color);
	}
</style>
```

If this impossible (for example, the child component comes from a library) you can use `:global` to override styles:

```svelte
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
	}
</style>
```

## Context

Consider using context instead of declaring state in a shared module. This will scope the state to the part of the app that needs it, and eliminate the possibility of it leaking between users when server-side rendering.

Use `createContext` rather than `setContext` and `getContext`, as it provides type safety.

## Async Svelte

If using version 5.36 or higher, you can use [await expressions](references/await-expressions.md) and [hydratable](references/hydratable.md) to use promises directly inside components. Note that these require the `experimental.async` option to be enabled in `svelte.config.js` as they are not yet considered fully stable.

## Component Testing

Every Svelte component that contains non-trivial logic (effects, derived state, event handlers that transform data, exported methods) **must** have a colocated `*.spec.ts` test file. Pure presentational wrappers (e.g. shadcn-svelte UI primitives) do not need tests.

### Setup

Tests run with `bun test` using happy-dom, `@testing-library/svelte`, and `@testing-library/jest-dom`. The preload in `packages/service/app/bunfig.toml` handles DOM registration and the Svelte compiler plugin.

### Mocking UI dependencies

Mock heavy UI libraries (`$lib/components/ui/*`, `@lucide/svelte/icons/*`) at the top of the spec file with `mock.module()` before any component imports. Use minimal no-op stubs — the goal is to test **component logic**, not pixel-perfect rendering.

### What to test

- **State transitions**: prop changes → correct `onchange` payloads
- **Effect behavior**: auto-wiring, syncing, reset on empty input
- **Exported methods**: e.g. `resolveAll()`, `reset()`
- **Edge cases**: empty state, missing data, adding/removing items

### Pattern

```ts
import { mock, describe, it, expect, beforeEach } from "bun:test";

// mock.module() calls for UI deps...

import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import MyComponent from "./MyComponent.svelte";

beforeEach(() => cleanup());

describe("MyComponent", () => {
  it("does the thing", async () => {
    const onchange = mock(() => {});
    const { container } = render(MyComponent, { props: { onchange } });
    await tick();
    expect(onchange).toHaveBeenCalled();
  });
});
```

Use `await tick()` (sometimes twice) to flush Svelte effects before asserting. Use `rerender()` to simulate prop changes.

## SvelteKit Remote Functions

### `form.for(key)` and field name collisions

When using `form.for(key)` to create form variants, SvelteKit's internal `convert()` function sets `data.id = key` if `FormData.has('id')` returns false. The `fields.id.as("number")` helper produces `name="n:id"` (prefixed), which does NOT satisfy `FormData.has('id')`. This causes the `.for()` key to silently overwrite the `id` field.

```svelte
<!-- ❌ Wrong — .for(tier.value) overwrites data.id with tier.value -->
{@const planForm = setBasePlan.for(tier.value)}
<form {...planForm}>
  <input {...planForm.fields.id.as("number")} type="hidden" value={user.id} />

<!-- ✅ Correct — .as("hidden") produces name="id", preventing key override -->
{@const planForm = setBasePlan.for(tier.value)}
<form {...planForm}>
  <input {...planForm.fields.id.as("hidden")} value={user.id} />
```

### Adapter externals must mirror SSR externals

Packages in Vite's `ssr.external` are kept external during the SSR build phase. But the adapter (e.g., `svelte-adapter-bun`) re-bundles with rolldown using `platform: "browser"`, which strips Node.js built-ins (`fs`, `path`). Packages that depend on Node.js APIs (like `@electric-sql/pglite` with its `nodefs` adapter) must also be listed in the adapter's `external` config:

```js
// svelte.config.js
adapter: adapter({
  external: ["@css-inline/css-inline", "@electric-sql/pglite"],
}),

// vite.config.ts — also needed here
ssr: {
  external: ["@electric-sql/pglite", "@css-inline/css-inline"],
}
```

## Avoid legacy features

Always use runes mode for new code, and avoid features that have more modern replacements:

- use `$state` instead of implicit reactivity (e.g. `let count = 0; count += 1`)
- use `$derived` and `$effect` instead of `$:` assignments and statements (but only use effects when there is no better solution)
- use `$props` instead of `export let`, `$$props` and `$$restProps`
- use `onclick={...}` instead of `on:click={...}`
- use `{#snippet ...}` and `{@render ...}` instead of `<slot>` and `$$slots` and `<svelte:fragment>`
- use `<DynamicComponent>` instead of `<svelte:component this={DynamicComponent}>`
- use `import Self from './ThisComponent.svelte'` and `<Self>` instead of `<svelte:self>`
- use classes with `$state` fields to share reactivity between components, instead of using stores
- use `{@attach ...}` instead of `use:action`
- use clsx-style arrays and objects in `class` attributes, instead of the `class:` directive
