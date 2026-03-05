<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import type { Icon } from "@lucide/svelte";
  let { items, currentPath, label }: { items: { title: string; url: string; icon?: typeof Icon; badge?: number }[]; currentPath: string; label?: string } =
    $props();

  function isActive(itemUrl: string, currentPath: string): boolean {
    if (itemUrl === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return currentPath.startsWith(itemUrl);
  }
</script>

<Sidebar.Group>
  {#if label}
    <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
  {/if}
  <Sidebar.GroupContent>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {@const active = isActive(item.url, currentPath)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton href={item.url} isActive={active} class={active ? "font-medium bg-sidebar-accent" : ""}>
            {#if item.icon}
              <item.icon />
            {/if}
            <span>{item.title}</span>
          </Sidebar.MenuButton>
          {#if item.badge && item.badge > 0}
            <Sidebar.MenuBadge>{item.badge}</Sidebar.MenuBadge>
          {/if}
        </Sidebar.MenuItem>
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
