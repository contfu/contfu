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
    navWorkspace: [
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
    ],
    navOperations: [
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

  const navOperationsItems = $derived(
    data.navOperations.map((item) =>
      item.url === "/incidents" ? { ...item, badge: incidentCount } : item,
    ),
  );
</script>

<Sidebar.Root collapsible="icon" {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg">
          {#snippet child({ props })}
            <a href="/dashboard" {...props}>
              <img src="/favicon.svg" alt="Logo" class="size-8" />
              <span class="text-base font-semibold">contfu</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain label="Workspace" items={data.navWorkspace} {currentPath} />
    <NavMain label="Operations" items={navOperationsItems} {currentPath} />
    <NavSecondary items={data.navSecondary} class="mt-auto" />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
