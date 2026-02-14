<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    CreditCardIcon,
    DatabaseIcon,
    FoldersIcon,
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
    ],
    navSecondary: [
      {
        title: "Admin",
        url: "/admin",
        icon: UserCogIcon,
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
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & { currentPath: string; user: DisplayUser } = $props();
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
    <NavMain items={data.navMain} {currentPath} />
    <NavSecondary items={data.navSecondary} class="mt-auto" />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
