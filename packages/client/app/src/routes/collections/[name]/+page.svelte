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
    <h1 class="text-lg"><span class="text-primary">$</span> contfu collections --show {data.collection.name}</h1>
    <Button href="/collections" variant="ghost" size="sm">&lt;- back</Button>
  </div>

  <div class="border border-border bg-card p-4">
    <div class="space-y-1 text-sm">
      <p><span class="text-muted-foreground">name</span><span class="mx-2 text-muted-foreground">=</span>{data.collection.name}</p>
      <p><span class="text-muted-foreground">ref</span><span class="mx-2 text-muted-foreground">=</span>{data.collection.ref}</p>
      <p><span class="text-muted-foreground">items</span><span class="mx-2 text-muted-foreground">=</span>{data.collection.itemCount}</p>
    </div>
  </div>

  {#if data.typeString != null}
    <div class="border border-border bg-card p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm text-muted-foreground uppercase tracking-widest">typescript types</h2>
        <CopyTextButton
          variant="outline"
          size="sm"
          text={data.typeString}
          label="copy"
          copiedLabel="copied"
        />
      </div>
      <pre class="overflow-x-auto bg-muted p-4 text-sm border border-border">{data.typeString}</pre>
    </div>
  {/if}

  <ItemListExplorer
    basePath={`/collections/${encodeURIComponent(data.collection.name)}`}
    query={data.query}
    collections={data.collections}
    result={data.result}
    lockedCollection={data.collection.name}
  />
</div>
