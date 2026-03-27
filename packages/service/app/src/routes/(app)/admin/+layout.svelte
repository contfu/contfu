<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import { UserCogIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { title: "users", url: "/admin/users" },
    { title: "settings", url: "/admin/settings" },
  ];

  const activeTab = $derived(tabs.find((t) => page.url.pathname.startsWith(t.url))?.url ?? tabs[0].url);
</script>

<SiteHeader icon={UserCogIcon} title="admin" />

<div class="px-6 pt-4">
  <Tabs.Root value={activeTab} onValueChange={(v) => goto(v)}>
    <Tabs.List>
      {#each tabs as tab (tab.url)}
        <Tabs.Trigger value={tab.url}>{tab.title}</Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>
</div>

{@render children()}
