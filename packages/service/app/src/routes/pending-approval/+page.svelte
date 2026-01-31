<script lang="ts">
  import { signOut } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";

  let { data } = $props();

  async function handleLogout() {
    await signOut();
    window.location.href = "/";
  }

  function handleRefresh() {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>Pending Approval - Contfu</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
  <div class="w-full max-w-md rounded-lg border border-border p-8">
    <div class="text-center">
      <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <svg class="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-2xl font-semibold">Awaiting Approval</h1>
      <p class="mt-2 text-muted-foreground">
        Thanks for signing up, {data.user?.name ?? "there"}!
      </p>
    </div>

    <p class="mt-6 text-center text-sm text-muted-foreground">
      Your account is pending approval. We're currently in closed beta and granting access
      as slots become available.
    </p>

    <div class="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <svg class="mt-0.5 h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <div class="text-sm">
        <p class="font-medium">We'll notify you!</p>
        <p class="text-muted-foreground">
          You'll receive an email at <span class="font-medium">{data.user?.email}</span> once
          your access is approved.
        </p>
      </div>
    </div>

    <div class="mt-6 flex flex-col gap-2">
      <Button variant="outline" onclick={handleRefresh} class="w-full gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Check Again
      </Button>
      <Button variant="ghost" onclick={handleLogout} class="w-full gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </Button>
    </div>
  </div>

  <p class="mt-6 text-center text-sm text-muted-foreground">
    Have questions? Reach out to us at{" "}
    <a href="mailto:mail@contfu.com" class="text-primary hover:underline">
      mail@contfu.com
    </a>
  </p>
</div>
