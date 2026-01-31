<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { signOut } from "$lib/auth-client";
  import Avatar from "./Avatar.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";

  export type DisplayUser = { email: string; name: string; image?: string; role?: number };

  let {
    user,
    isUnderConstruction,
  }: {
    user: DisplayUser | null;
    isUnderConstruction: boolean;
  } = $props();

  const isAdmin = user?.role === 1;

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
    goto("/login");
  }
</script>

<header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
  <div class="mx-auto max-w-6xl px-4 sm:px-6">
    <div class="flex h-14 items-center justify-between">
      <!-- Logo -->
      <a
        href={user ? "/dashboard" : "/"}
        class="flex items-center gap-2"
        aria-label={user ? "Go to dashboard" : "Go to home"}
      >
        <img
          src="/favicon.svg"
          alt=""
          height={28}
          width={28}
          class="h-7 w-7"
        />
        <span class="font-semibold tracking-tight text-foreground">contfu</span>
      </a>

      {#if !isUnderConstruction}
        <nav class="flex items-center gap-1">
          {#if user}
            <!-- Main nav links -->
            {#each navLinks as { href, label }}
              <a
                {href}
                class="hidden px-3 py-1.5 text-sm transition-colors sm:block {isActiveLink(href)
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                {label}
              </a>
            {/each}

            <div class="ml-2 flex items-center gap-2">
              <ThemeToggle />
              
              <!-- User dropdown -->
              <div class="relative">
                <button
                  class="peer flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onclick={(e) => {
                    if (isOpen) e.currentTarget.blur();
                    else isOpen = true;
                  }}
                  onblur={() => (isOpen = false)}
                >
                  <Avatar {user} />
                  <span class="hidden text-sm sm:block">{user.name}</span>
                </button>
                <div
                  class="absolute right-0 top-full mt-1 hidden w-40 rounded-md border border-border bg-popover py-1 shadow-md peer-focus:block"
                  onmousedown={(e) => e.preventDefault()}
                >
                  <a
                    href="/billing"
                    class="block px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent"
                  >
                    Billing
                  </a>
                  {#if isAdmin}
                    <a
                      href="/admin/users"
                      class="block px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent"
                    >
                      Admin
                    </a>
                  {/if}
                  <button
                    type="button"
                    onclick={handleLogout}
                    class="block w-full px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          {:else}
            <a href="/#features" class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="/#beta" class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
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
