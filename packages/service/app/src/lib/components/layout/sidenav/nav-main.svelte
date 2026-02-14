<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import type { Icon } from "@lucide/svelte";
  let { items, currentPath }: { items: { title: string; url: string; icon?: typeof Icon }[]; currentPath: string } =
    $props();

  function isActive(itemUrl: string, currentPath: string): boolean {
    if (itemUrl === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return currentPath.startsWith(itemUrl);
  }
</script>

<Sidebar.Group>
  <Sidebar.GroupContent class="flex flex-col gap-2">
    <Sidebar.Menu>
      {#each items as item (item.title)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton href={item.url} isActive={isActive(item.url, currentPath)}>
            {#if item.icon}
              <item.icon />
            {/if}
            <span>{item.title}</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
