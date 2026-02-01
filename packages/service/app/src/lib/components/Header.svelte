<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { signOut } from "$lib/auth-client";
  import * as Avatar from "$lib/components/ui/avatar";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import {
    CreditCardIcon,
    EllipsisVerticalIcon,
    LogOutIcon,
    UserCogIcon,
  } from "@lucide/svelte";
  import ThemeToggle from "./ThemeToggle.svelte";

  import { UserRole, type UserRole as UserRoleType } from "$lib/constants/user";
  import Button from "./ui/button/button.svelte";

  export type DisplayUser = {
    email: string;
    name: string;
    image?: string;
    role?: UserRoleType;
  };

  let {
    user,
    isUnderConstruction,
  }: {
    user: DisplayUser | null;
    isUnderConstruction: boolean;
  } = $props();

  const isAdmin = $derived(user?.role === UserRole.ADMIN);

  let isOpen = $state(false);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/sources", label: "Sources" },
    { href: "/clients", label: "Clients" },
  ];

  function isActiveLink(href: string): boolean {
    const path = page.url?.pathname ?? "";
    if (href === "/dashboard") {
      return path === "/dashboard";
    }
    return path.startsWith(href);
  }

  async function handleLogout() {
    await signOut();
    await invalidateAll();
    goto("/login");
  }
</script>

<header
  class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
>
  <div class="mx-auto max-w-6xl px-4 sm:px-6">
    <div class="flex h-14 items-center justify-between">
      <!-- Logo -->
      <a
        href={user ? "/dashboard" : "/"}
        class="flex items-center gap-2"
        aria-label={user ? "Go to dashboard" : "Go to home"}
      >
        <img src="/favicon.svg" alt="" height={28} width={28} class="h-7 w-7" />
        <span class="font-semibold tracking-tight text-foreground">contfu</span>
      </a>

      {#if !isUnderConstruction}
        <nav class="flex items-center gap-1">
          {#if user}
            <!-- Main nav links -->
            {#each navLinks as { href, label }}
              <a
                {href}
                class="hidden px-3 py-1.5 text-sm transition-colors sm:block {isActiveLink(
                  href,
                )
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                {label}
              </a>
            {/each}

            <div class="ml-2 flex items-center gap-2">
              <ThemeToggle />

              <!-- User dropdown -->
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} size="lg" variant="outline" class="px-1">
                      <Avatar.Root class="size-8 rounded-lg grayscale">
                        <Avatar.Image src={user.image} alt={user.name} />
                        <Avatar.Fallback class="rounded-lg"
                          >{user.name.charAt(0)}</Avatar.Fallback
                        >
                      </Avatar.Root>
                      <div class="grid flex-1 text-start text-sm leading-tight">
                        <span class="truncate font-medium">{user.name}</span>
                        <span class="text-muted-foreground truncate text-xs">
                          {user.email}
                        </span>
                      </div>
                      <EllipsisVerticalIcon class="ms-auto size-4" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenu.Label class="p-0 font-normal">
                    <div
                      class="flex items-center gap-2 px-1 py-1.5 text-start text-sm"
                    >
                      <Avatar.Root class="size-8 rounded-lg">
                        <Avatar.Image src={user.image} alt={user.name} />
                        <Avatar.Fallback class="rounded-lg"
                          >{user.name.charAt(0)}</Avatar.Fallback
                        >
                      </Avatar.Root>
                      <div class="grid flex-1 text-start text-sm leading-tight">
                        <span class="truncate font-medium">{user.name}</span>
                        <span class="text-muted-foreground truncate text-xs">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Group>
                    <DropdownMenu.Item onclick={() => goto("/billing")}>
                      <CreditCardIcon />
                      Billing
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onclick={() => goto("/admin")}>
                      <UserCogIcon />
                      Admin
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onclick={handleLogout}>
                    <LogOutIcon />
                    Log out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          {:else}
            <a
              href="/#features"
              class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Features
            </a>
            <a
              href="/#beta"
              class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Beta
            </a>
            <a
              href="/login"
              class="ml-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </a>
          {/if}
        </nav>
      {/if}
    </div>
  </div>
</header>
