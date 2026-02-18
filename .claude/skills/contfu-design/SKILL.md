---
name: contfu-design
description: Design beautiful, distinctive UI for Contfu. Use when creating or redesigning interfaces, components, layouts, or visual systems. Focuses on craft, personality, and avoiding generic "AI slop" aesthetics. Applies to the SvelteKit app with TailwindCSS and shadcn-svelte.
---

# Contfu Design System

Create interfaces with craft and personality. No AI slop.

## Anti-Patterns: What Makes UI Feel Generic

Avoid these "AI slop" tells:

- **Gratuitous gradients** — Purple-to-blue on everything
- **Excessive rounded corners** — Not everything needs `rounded-2xl`
- **Generic hero sections** — "Welcome to [Product]" with stock imagery
- **Overuse of cards** — Grid of identical rounded rectangles
- **Meaningless icons** — Decorative icons that add no information
- **Corporate blue** — The safe, forgettable `#3B82F6`
- **Centered everything** — No visual hierarchy or tension
- **Buzzword headings** — "Seamless", "Powerful", "Revolutionary"

## Design Principles

### 1. Purposeful Restraint

Less decoration, more function. Every element earns its place.

```svelte
<!-- ❌ Over-designed -->
<div class="bg-gradient-to-br from-purple-500 to-blue-600 rounded-3xl shadow-2xl p-8">
  <div class="flex items-center gap-4">
    <div class="p-3 bg-white/20 rounded-xl">
      <Icon class="w-8 h-8 text-white" />
    </div>
    <h3 class="text-2xl font-bold text-white">Feature Title</h3>
  </div>
</div>

<!-- ✅ Purposeful -->
<div class="border-l-2 border-zinc-200 pl-4 py-2">
  <h3 class="font-medium text-zinc-900">Feature Title</h3>
  <p class="text-sm text-zinc-600 mt-1">Concise description.</p>
</div>
```

### 2. Typography as Design

Let type do the heavy lifting. Invest in hierarchy.

```css
/* System with personality */
--font-display: "Inter", system-ui; /* Or: Söhne, Geist, Satoshi */
--font-mono: "JetBrains Mono", monospace;

/* Tight tracking for headings */
.heading {
  letter-spacing: -0.02em;
}

/* Generous line-height for body */
.body {
  line-height: 1.6;
}
```

### 3. Intentional Color

Start with near-black and near-white. Add color sparingly.

```js
// Contfu palette suggestion
colors: {
  zinc: { /* Tailwind zinc for neutrals */ },
  accent: {
    DEFAULT: '#0F172A',  // Near-black for primary actions
    muted: '#64748B',    // Slate for secondary
  },
  surface: {
    DEFAULT: '#FAFAFA',
    elevated: '#FFFFFF',
  },
  // Contfu brand color — use sparingly
  brand: '#44acbc',      // Contfu teal for primary accent
}
```

### 4. Meaningful Motion

Animation should provide feedback, not decoration.

```svelte
<!-- Subtle, functional transitions -->
<button class="transition-colors duration-150 hover:bg-zinc-100">

<!-- Not this -->
<button class="animate-pulse hover:scale-110 transition-all duration-500">
```

### 5. Density & Information

Developer tools should be information-dense. Respect expertise.

```svelte
<!-- ❌ Wasteful spacing -->
<div class="p-12 space-y-8">
  <Card class="p-8">One item</Card>
  <Card class="p-8">Another item</Card>
</div>

<!-- ✅ Efficient -->
<div class="divide-y divide-zinc-100">
  <div class="py-3 px-4">One item</div>
  <div class="py-3 px-4">Another item</div>
</div>
```

## Component Patterns

### Tables (Not Card Grids)

For data, use tables. They're information-dense and scannable.

```svelte
<table class="w-full text-sm">
  <thead class="text-left text-zinc-500 border-b">
    <tr>
      <th class="pb-2 font-medium">Name</th>
      <th class="pb-2 font-medium">Status</th>
      <th class="pb-2 font-medium text-right">Items</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-zinc-100">
    <tr class="hover:bg-zinc-50">
      <td class="py-3">Blog Posts</td>
      <td class="py-3"><Badge variant="success">Synced</Badge></td>
      <td class="py-3 text-right font-mono">1,234</td>
    </tr>
  </tbody>
</table>
```

### Status Indicators

Subtle, not flashy.

```svelte
<!-- Sync status -->
<span class="inline-flex items-center gap-1.5 text-sm">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
  Synced
</span>

<!-- With timestamp -->
<span class="text-zinc-500 text-xs">
  Last sync: <time class="font-mono">2m ago</time>
</span>
```

### Empty States

Helpful, not cute.

```svelte
<div class="py-12 text-center">
  <p class="text-zinc-500">No collections configured</p>
  <Button variant="outline" class="mt-4">Add Collection</Button>
</div>
```

### Navigation

Clean sidebar, no icons unless necessary.

```svelte
<nav class="w-56 border-r border-zinc-200 py-4">
  <div class="px-4 mb-4">
    <span class="font-semibold tracking-tight">contfu</span>
  </div>
  <ul class="space-y-0.5">
    <li>
      <a href="/collections" class="block px-4 py-1.5 text-sm hover:bg-zinc-100
        {$page.url.pathname === '/collections' ? 'bg-zinc-100 font-medium' : 'text-zinc-600'}">
        Collections
      </a>
    </li>
  </ul>
</nav>
```

## Stack Reference

- **Framework**: SvelteKit
- **Styling**: TailwindCSS v4
- **Components**: shadcn-svelte (bits-ui)
- **Icons**: Lucide (`@lucide/svelte`)

### shadcn-svelte Usage

```bash
bunx shadcn-svelte add button
bunx shadcn-svelte add table
bunx shadcn-svelte add badge
```

Customize in `src/lib/components/ui/`. Don't use defaults blindly.

## File Structure

```
src/lib/
├── components/
│   ├── ui/           # shadcn-svelte primitives
│   └── app/          # Contfu-specific components
├── styles/
│   └── app.css       # Global styles, CSS variables
```

## Review Checklist

Before shipping UI:

- [ ] Would a human designer do this, or is it "safe AI output"?
- [ ] Is there unnecessary decoration?
- [ ] Does color serve a purpose?
- [ ] Is information density appropriate for the audience?
- [ ] Do animations provide feedback or just look cool?
- [ ] Is the typography hierarchy clear?
- [ ] Could this be simpler?
