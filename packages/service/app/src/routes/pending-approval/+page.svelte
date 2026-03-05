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
  <div class="w-full max-w-md border border-border p-8">
    <div>
      <p class="text-xs text-muted-foreground mb-2">status/pending</p>
      <h1 class="text-xl font-semibold">
        <span class="text-warning">~</span> awaiting approval
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        hey {data.user?.name ?? "there"}, thanks for signing up.
      </p>
    </div>

    <p class="mt-6 text-xs text-muted-foreground">
      Your account is pending approval. We're in closed beta and granting access
      as slots become available.
    </p>

    <div class="mt-6 border border-border bg-card p-4">
      <div class="text-xs text-primary mb-1">--notify</div>
      <p class="text-xs text-muted-foreground">
        You'll receive an email at <span class="text-foreground">{data.user?.email}</span> once approved.
      </p>
    </div>

    <div class="mt-6 flex flex-col gap-2">
      <Button variant="outline" onclick={handleRefresh} class="w-full">
        check --status
      </Button>
      <Button variant="ghost" onclick={handleLogout} class="w-full">
        logout
      </Button>
    </div>
  </div>

  <p class="mt-6 text-xs text-muted-foreground">
    questions? <a href="mailto:mail@contfu.com" class="text-primary hover:underline">mail@contfu.com</a>
  </p>
</div>
