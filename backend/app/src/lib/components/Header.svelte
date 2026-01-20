<script lang="ts">
  import { goto } from "$app/navigation";
  import { signOut } from "$lib/auth-client";
  import Avatar from "./Avatar.svelte";
  import Button from "./ui/button/button.svelte";

  export type DisplayUser = { email: string; name: string; image?: string };

  let {
    user,
    isUnderConstruction,
  }: {
    user: DisplayUser | null;
    isUnderConstruction: boolean;
  } = $props();

  let isOpen = $state(false);

  async function handleLogout() {
    await signOut();
    goto("/login");
  }
</script>

<header class="fixed top-0 w-full bg-white shadow-sm dark:bg-gray-800">
  <div class="container mx-auto px-4">
    <div class="flex h-16 items-center justify-between">
      <div class="flex items-center gap-2">
        <a
          href={user ? "/dashboard" : "/"}
          class="text-xl font-bold text-gray-900 dark:text-white"
          aria-label={user ? "Go to dashboard" : "Go to home"}
        >
          <img
            src="/logo.svg"
            alt="Contfu"
            height={64}
            width={178}
            class="h-12 hidden md:block"
          />
          <img
            src="/favicon.svg"
            alt="Contfu"
            height={64}
            width={64}
            class="h-12 block md:hidden"
          />
        </a>
      </div>
      {#if !isUnderConstruction}
        <nav class="flex h-full items-center sm:gap-1 md:gap-2">
          {#if user}
            <div class="relative flex h-full items-center">
              <button
                class="peer flex h-14 items-center space-x-2 rounded-lg px-4 py-0 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onclick={(e) => {
                  if (isOpen) e.currentTarget.blur();
                  else isOpen = true;
                }}
                onblur={() => (isOpen = false)}
              >
                <Avatar {user} />
              </button>
              <div
                class="absolute right-0 top-14 mt-2 hidden w-48 bg-white py-2 shadow-lg peer-focus:block dark:bg-gray-800"
                onmousedown={(e) => e.preventDefault()}
              >
                <span
                  class="block w-full px-4 py-2 text-gray-400 dark:text-gray-500"
                >
                  {user.name}
                </span>
                <a
                  href="/billing"
                  class="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Billing
                </a>
                <button
                  type="button"
                  onclick={handleLogout}
                  class="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          {:else}
            <Button variant="link" href="/#features">Features</Button>
            <Button variant="link" href="/#pricing">Pricing</Button>
          {/if}
        </nav>
      {/if}
      <Button variant="default" href="/login">Login</Button>
    </div>
  </div>
</header>
