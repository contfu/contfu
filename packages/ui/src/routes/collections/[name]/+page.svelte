<script lang="ts">
  import { error } from "@sveltejs/kit";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import { parseItemQueryFromUrl } from "$lib/query/item-query";
  import { getCollectionDetailQuery, getCollectionsQuery } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import * as Card from "$lib/components/ui/card";
  import { onMount } from "svelte";

  const query = $derived(parseItemQueryFromUrl(page.url, { lockedCollection: page.params.name }));
  const [collections, detail] = $derived(
    await Promise.all([
      getCollectionsQuery(),
      getCollectionDetailQuery({
        name: page.params.name,
        input: query,
      }),
    ]),
  );

  const collection = $derived.by(() => {
    if (!detail.collection) error(404, "Collection not found");
    return detail.collection;
  });
  const result = $derived(detail.result);
  const typeString = $derived(detail.typeString);

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
  });
</script>

<div class="page-shell space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-lg"><span class="text-primary">$</span> contfu collections get {collection.name}</h1>
    <Button href="/collections" variant="ghost" size="sm">&lt;- back</Button>
  </div>

  <div class="border border-border bg-card p-4">
    <div class="space-y-1 text-sm">
      <p><span class="text-muted-foreground">name</span><span class="mx-2 text-muted-foreground">=</span>{collection.name}</p>
      <p><span class="text-muted-foreground">items</span><span class="mx-2 text-muted-foreground">=</span>{collection.itemCount}</p>
    </div>
  </div>

  {#if typeString != null}
    <div class="border border-border bg-card p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm text-muted-foreground uppercase tracking-widest">typescript types</h2>
        <CopyTextButton
          variant="outline"
          size="sm"
          text={typeString}
          label="copy"
          copiedLabel="copied"
        />
      </div>
      <pre class="overflow-x-auto bg-muted p-4 text-sm border border-border">{typeString}</pre>
    </div>
  {/if}

  <ItemListExplorer
    basePath={`/collections/${encodeURIComponent(collection.name)}`}
    {query}
    {collections}
    {result}
    lockedCollection={collection.name}
  />
</div>
