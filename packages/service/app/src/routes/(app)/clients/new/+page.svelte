<script lang="ts">
  import { createConsumer } from "$lib/remote/consumers.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
</script>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <div class="mb-6">
    <a href="/clients" class="text-sm text-muted-foreground hover:text-foreground">← Clients</a>
  </div>

  <div class="mb-8">
    <h1 class="text-2xl font-semibold tracking-tight">Add Client</h1>
    <p class="mt-1 text-sm text-muted-foreground">Create a client to get an API key</p>
  </div>

  <form method="post" action={createConsumer.action} class="space-y-5">
    <div class="space-y-1.5">
      <Label for="name">Name</Label>
      <Input id="name" name="name" type="text" placeholder="My Application" required />
      <p class="text-xs text-muted-foreground">
        E.g., "Production Website" or "Development App"
      </p>
      {#if createConsumer.fields?.name?.issues()?.length}
        <p class="text-sm text-destructive">{createConsumer.fields?.name?.issues()?.[0]?.message}</p>
      {/if}
    </div>

    <div class="flex gap-2 pt-2">
      <Button type="submit" disabled={!!createConsumer.pending}>
        {createConsumer.pending ? "Creating..." : "Create Client"}
      </Button>
      <Button variant="outline" href="/clients">Cancel</Button>
    </div>
  </form>
</div>
