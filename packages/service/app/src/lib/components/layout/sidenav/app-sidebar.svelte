<script lang="ts">
  // @ts-nocheck
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    AlertTriangleIcon,
    FoldersIcon,
    LayoutDashboardIcon,
    PlugIcon,
    UserCogIcon,
  } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";
  import NavMain from "./nav-main.svelte";
  import NavSecondary from "./nav-secondary.svelte";
  import NavUser from "./nav-user.svelte";
  import type { DisplayUser } from "$lib/components/Header.svelte";

  const data = {
    navMain: [
      {
        title: "dashboard",
        url: "/dashboard",
        icon: LayoutDashboardIcon,
      },
      {
        title: "connections",
        url: "/connections",
        icon: PlugIcon,
      },
      {
        title: "collections",
        url: "/collections",
        icon: FoldersIcon,
      },
      {
        title: "incidents",
        url: "/incidents",
        icon: AlertTriangleIcon,
      },
    ],
    navSecondary: [
      {
        title: "admin",
        url: "/admin",
        icon: UserCogIcon,
      },
    ],
  };

  let {
    currentPath,
    user,
    incidentCount = 0,
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & { currentPath: string; user: DisplayUser; incidentCount?: number } = $props();

  const navMainItems = $derived(
    data.navMain.map((item) =>
      item.url === "/incidents" ? { ...item, badge: incidentCount } : item,
    ),
  );
</script>

<Sidebar.Root collapsible="icon" {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="lg data-[slot=sidebar-menu-button]:!p-1.5 h-16">
          {#snippet child({ props })}
            <a href="/dashboard" {...props} style="padding: 0!important">
              <img src="/favicon.svg" alt="contfu" class="h-7 w-auto ml-1" />
              <span class="font-mono text-base font-semibold tracking-tight">contfu</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain items={navMainItems} {currentPath} />
    <NavSecondary items={data.navSecondary} {currentPath} class="mt-auto" />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
