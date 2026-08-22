<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import { parseItemQueryFromUrl } from "$lib/query/item-query";
  import { getCollectionsQuery } from "$lib/remote/collections.remote";
  import { getItemsQuery } from "$lib/remote/items.remote";
  import { onMount } from "svelte";

  const query = $derived(parseItemQueryFromUrl(new URL(page.url.href)));
  const [collections, result] = $derived(
    await Promise.all([getCollectionsQuery(), getItemsQuery(query)]),
  );

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
  });
</script>

<div class="page-shell p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight">Items</h1>
  </div>

  <ItemListExplorer basePath="/items" {query} {collections} {result} />
</div>
