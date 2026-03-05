<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import type { Icon } from "@lucide/svelte";
  let { items, currentPath }: { items: { title: string; url: string; icon?: typeof Icon; badge?: number }[]; currentPath: string } =
    $props();

  function isActive(itemUrl: string, currentPath: string): boolean {
    if (itemUrl === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return currentPath.startsWith(itemUrl);
  }
</script>

<Sidebar.Group>
  <Sidebar.GroupContent class="flex flex-col gap-0.5">
    <Sidebar.Menu>
      {#each items as item (item.title)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton href={item.url} isActive={isActive(item.url, currentPath)} class="font-mono text-sm">
            {#if isActive(item.url, currentPath)}
              <span class="text-primary font-bold">&gt;</span>
            {:else if item.icon}
              <item.icon class="size-4 opacity-50" />
            {/if}
            <span class={isActive(item.url, currentPath) ? "text-primary font-medium" : ""}>{item.title}</span>
          </Sidebar.MenuButton>
          {#if item.badge && item.badge > 0}
            <Sidebar.MenuBadge class="font-mono">{item.badge}</Sidebar.MenuBadge>
          {/if}
        </Sidebar.MenuItem>
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
