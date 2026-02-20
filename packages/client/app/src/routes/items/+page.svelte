<script lang="ts">
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto max-w-6xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Items</h1>
  </div>

  <ItemListExplorer
    basePath="/items"
    query={data.query}
    collections={data.collections}
    result={data.result}
  />
</div>
