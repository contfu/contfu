<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import LiveRouteRefresh from "$lib/components/LiveRouteRefresh.svelte";
  import { ModeWatcher } from "mode-watcher";
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="system" />
<LiveRouteRefresh />
<div class="flex min-h-screen flex-col">
  <nav class="border-b">
    <div class="container mx-auto flex max-w-6xl gap-2 p-4 text-sm">
      <Button href="/" variant={page.url.pathname === "/" ? "secondary" : "ghost"} size="sm">
        Dashboard
      </Button>
      <Button
        href="/items"
        variant={page.url.pathname.startsWith("/items") ? "secondary" : "ghost"}
        size="sm"
      >
        Items
      </Button>
      <Button
        href="/collections"
        variant={page.url.pathname.startsWith("/collections") ? "secondary" : "ghost"}
        size="sm"
      >
        Collections
      </Button>
    </div>
  </nav>
  <main class="flex-1">{@render children()}</main>
</div>
