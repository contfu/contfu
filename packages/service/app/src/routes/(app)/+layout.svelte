<script lang="ts">
  // @ts-nocheck
  import { page } from "$app/state";
  import AppSidebar from "$lib/components/layout/sidenav/app-sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { getIncidentCount } from "$lib/remote/incidents.remote";

  let { children, data } = $props();

  const incidentCountQuery = getIncidentCount();
  const incidentCount = $derived(incidentCountQuery?.current ?? 0);
</script>

<Sidebar.Provider style="--sidebar-width: calc(var(--spacing) * 54); --header-height: calc(var(--spacing) * 12);">
  <AppSidebar currentPath={page.url.pathname} user={data.user} {incidentCount} />
  <Sidebar.Inset class="@container/main">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
