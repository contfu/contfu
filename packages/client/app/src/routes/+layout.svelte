<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();

  const navLinks = [
    { href: "/", label: "Dashboard", exact: true },
    { href: "/items", label: "Items" },
    { href: "/collections", label: "Collections" },
  ];

  function isActive(href: string, exact: boolean = false): boolean {
    if (exact) return page.url.pathname === href;
    return page.url.pathname.startsWith(href);
  }
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="system" />
<div class="flex min-h-screen flex-col">
  <nav class="border-b">
    <div class="container mx-auto flex max-w-6xl items-center gap-6 px-4">
      <a href="/" class="flex items-center gap-2 py-3">
        <img src="/favicon.svg" alt="contfu" class="size-6" />
        <span class="text-sm font-semibold">contfu</span>
      </a>
      <div class="flex gap-1">
        {#each navLinks as link}
          <a
            href={link.href}
            class="border-b-2 px-3 py-3 text-sm transition-colors {isActive(link.href, link.exact)
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'}"
          >
            {link.label}
          </a>
        {/each}
      </div>
    </div>
  </nav>
  <main class="flex-1">{@render children()}</main>
</div>
