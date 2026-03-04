<script lang="ts">
  // @ts-nocheck
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    AlertTriangleIcon,
    CreditCardIcon,
    DatabaseIcon,
    FoldersIcon,
    KeyIcon,
    LayoutDashboardIcon,
    UserCogIcon,
    UsersIcon,
  } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";
  import NavMain from "./nav-main.svelte";
  import NavSecondary from "./nav-secondary.svelte";
  import NavUser from "./nav-user.svelte";
  import type { DisplayUser } from "$lib/components/Header.svelte";

  const data = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboardIcon,
      },
      {
        title: "Sources",
        url: "/sources",
        icon: DatabaseIcon,
      },
      {
        title: "Collections",
        url: "/collections",
        icon: FoldersIcon,
      },
      {
        title: "Consumers",
        url: "/consumers",
        icon: UsersIcon,
      },
      {
        title: "Incidents",
        url: "/incidents",
        icon: AlertTriangleIcon,
      },
    ],
    navSecondary: [
      {
        title: "Admin",
        url: "/admin",
        icon: UserCogIcon,
      },
      {
        title: "API Keys",
        url: "/admin/api-keys",
        icon: KeyIcon,
      },
      {
        title: "Billing",
        url: "/billing",
        icon: CreditCardIcon,
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
              <img src="/favicon.svg" alt="Logo" class="size-16" />
              <span class="text-base font-semibold">contfu</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain items={navMainItems} {currentPath} />
    <NavSecondary items={data.navSecondary} class="mt-auto" />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
