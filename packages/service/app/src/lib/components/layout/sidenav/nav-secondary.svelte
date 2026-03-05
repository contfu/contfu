<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { MoonIcon, SunIcon } from "@lucide/svelte";
  import type { Icon } from "@lucide/svelte";
  import { mode, setMode } from "mode-watcher";

  let { items }: { items: { title: string; url: string; icon: typeof Icon }[] } = $props();
</script>

<Sidebar.Group class="mt-auto">
  <Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
  <Sidebar.GroupContent>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton href={item.url} class="font-mono text-sm">
            {#if item.icon}
              <item.icon class="size-4 opacity-50" />
            {/if}
            <span>{item.title}</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/each}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          onclick={() => setMode(mode.current === "dark" ? "light" : "dark")}
          class="font-mono text-sm"
        >
          {#if mode.current === "dark"}
            <MoonIcon class="size-4 opacity-50" />
          {:else}
            <SunIcon class="size-4 opacity-50" />
          {/if}
          <span>theme</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
