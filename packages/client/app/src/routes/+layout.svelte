<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ModeWatcher } from "mode-watcher";
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="dark" />
<div class="flex min-h-screen flex-col">
  <nav class="border-b border-border bg-card">
    <div class="container mx-auto flex max-w-6xl items-center gap-1 px-4 py-2 text-sm">
      <a href="/" class="mr-4 flex items-center gap-2">
        <img src="/favicon.svg" alt="contfu" class="h-5 w-auto" />
        <span class="font-semibold tracking-tight">contfu</span>
      </a>
      <Button href="/" variant={page.url.pathname === "/" ? "secondary" : "ghost"} size="sm">
        ~/dashboard
      </Button>
      <span class="text-muted-foreground">/</span>
      <Button
        href="/items"
        variant={page.url.pathname.startsWith("/items") ? "secondary" : "ghost"}
        size="sm"
      >
        ~/items
      </Button>
      <span class="text-muted-foreground">/</span>
      <Button
        href="/collections"
        variant={page.url.pathname.startsWith("/collections") ? "secondary" : "ghost"}
        size="sm"
      >
        ~/collections
      </Button>
    </div>
  </nav>
  <main class="flex-1">{@render children()}</main>
</div>
