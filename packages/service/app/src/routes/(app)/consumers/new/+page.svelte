<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { createConsumer } from "$lib/remote/consumers.remote";
  import { useId } from "bits-ui";

  const nameId = useId();
</script>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <div class="mb-6">
    <a
      href="/consumers"
      class="text-sm text-muted-foreground hover:text-foreground">← Consumers</a
    >
  </div>

  <div class="mb-8">
    <h1 class="text-2xl font-semibold tracking-tight">Add Consumer</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Create a consumer to get an API key
    </p>
  </div>

  <form {...createConsumer} class="space-y-5">
    <div class="space-y-1.5">
      <Label for={nameId}>Name</Label>
      <Input
        id={nameId}
        name="name"
        placeholder="My Application"
        required
      />
      <p class="text-xs text-muted-foreground">
        E.g., "Production Website" or "Development App"
      </p>
      {#if createConsumer.error}
        <p class="text-sm text-destructive">
          {createConsumer.error}
        </p>
      {/if}
    </div>

    <div class="flex gap-2 pt-2">
      <Button type="submit" disabled={!!createConsumer.pending}>
        {createConsumer.pending ? "Creating..." : "Create Consumer"}
      </Button>
      <Button variant="outline" href="/consumers">Cancel</Button>
    </div>
  </form>
</div>
