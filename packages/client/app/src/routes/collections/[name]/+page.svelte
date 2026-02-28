<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import { Button } from "$lib/components/ui/button";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import * as Card from "$lib/components/ui/card";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
  });
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Collection: {data.collection.name}</h1>
    <Button href="/collections" variant="ghost" size="sm">Back to collections</Button>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{data.collection.name}</Card.Title>
      <Card.Description>Collection detail</Card.Description>
    </Card.Header>
    <Card.Content>
      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted-foreground">Ref</dt>
          <dd>{data.collection.ref}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Items</dt>
          <dd>{data.collection.itemCount}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>

  {#if data.typeString != null}
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>TypeScript Types</Card.Title>
            <Card.Description>Generated from the collection schema</Card.Description>
          </div>
          <CopyTextButton
            variant="outline"
            size="sm"
            text={data.typeString}
            label="Copy"
            copiedLabel="Copied!"
          />
        </div>
      </Card.Header>
      <Card.Content>
        <pre class="overflow-x-auto rounded-md bg-muted p-4 text-sm">{data.typeString}</pre>
      </Card.Content>
    </Card.Root>
  {/if}

  <ItemListExplorer
    basePath={`/collections/${encodeURIComponent(data.collection.name)}`}
    query={data.query}
    collections={data.collections}
    result={data.result}
    lockedCollection={data.collection.name}
  />
</div>
