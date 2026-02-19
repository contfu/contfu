<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { createConsumer } from "$lib/remote/consumers.remote";
  import { useId } from "bits-ui";

  const nameId = useId();
  let includeRef = $state(true);
</script>

<SiteHeader title="Add Consumer">
  <a
    href="/consumers"
    class="ml-auto text-sm text-muted-foreground hover:text-foreground"
  >
    ← Consumers
  </a>
</SiteHeader>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <p class="mb-8 text-sm text-muted-foreground">
    Create a consumer to get an API key
  </p>

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

    <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label for="consumer-include-ref">Forward source item references</Label>
      <Switch id="consumer-include-ref" bind:checked={includeRef} />
      <input name="includeRef" type="hidden" value={includeRef ? "true" : "false"} />
    </div>

    <div class="flex gap-2 pt-2">
      <Button type="submit" disabled={!!createConsumer.pending}>
        {createConsumer.pending ? "Creating..." : "Create Consumer"}
      </Button>
      <Button variant="outline" href="/consumers">Cancel</Button>
    </div>
  </form>
</div>
