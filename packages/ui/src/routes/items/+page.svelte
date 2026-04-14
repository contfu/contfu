<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

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

  <ItemListExplorer
    basePath="/items"
    query={data.query}
    collections={data.collections}
    result={data.result}
  />
</div>
