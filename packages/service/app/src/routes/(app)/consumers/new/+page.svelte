<script lang="ts">
  // @ts-nocheck
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "@contfu/ui";
  import { createConsumer } from "$lib/remote/consumers.remote";
  import { useId } from "bits-ui";

  const nameId = useId();

</script>

<SiteHeader title="add consumer">
  <a
    href="/consumers"
    class="ml-auto text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; consumers
  </a>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-8 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu consumers create
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
      <Switch
        id="consumer-include-ref"
        {...createConsumer.fields.includeRef.as("checkbox")}
      />
    </div>

    <div class="flex gap-2 pt-2">
      <Button type="submit" disabled={!!createConsumer.pending}>
        {createConsumer.pending ? "Creating..." : "Create Consumer"}
      </Button>
      <Button variant="outline" href="/consumers">Cancel</Button>
    </div>
  </form>
</div>
