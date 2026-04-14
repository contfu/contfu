# @contfu/ui

SvelteKit dashboard for Contfu.

Browser-side application that connects to `@contfu/server` to display and manage content. Built with SvelteKit, Tailwind CSS, and shadcn-svelte components.

## Development

```sh
bun dev        # start Vite dev server
bun build      # production build
bun preview    # preview production build
```

## Structure

- `src/routes/` — SvelteKit file-based routes
- `src/lib/components/` — shared UI components
- `build/` — compiled output served by `@contfu/server`

This package is not published to npm. Its build output is bundled with `@contfu/server`.
