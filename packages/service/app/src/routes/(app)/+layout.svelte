<script lang="ts">
  import { page } from "$app/state";
  import AppSidebar from "$lib/components/layout/sidenav/app-sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";

  let { children, data } = $props();
</script>

<Sidebar.Provider style="--sidebar-width: calc(var(--spacing) * 54); --header-height: calc(var(--spacing) * 12);">
  <AppSidebar currentPath={page.url.pathname} user={data.user} />
  <Sidebar.Inset class="@container/main">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
