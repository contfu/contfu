<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { getCollections } from "$lib/remote/collections.remote";
  import { Plus } from "@lucide/svelte";

  const collections = await getCollections();
</script>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Collections</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Aggregation targets that consumers subscribe to
      </p>
    </div>
    <Button href="/collections/new">
      <Plus class="mr-2 size-4" />
      Add Collection
    </Button>
  </div>

  {#if collections.length === 0}
    <div class="rounded-lg border border-dashed p-12 text-center">
      <h3 class="text-lg font-medium">No collections yet</h3>
      <p class="mt-2 text-sm text-muted-foreground">
        Create a collection to aggregate content from multiple sources.
      </p>
      <Button href="/collections/new" class="mt-4">
        <Plus class="mr-2 size-4" />
        Create your first collection
      </Button>
    </div>
  {:else}
    <div class="divide-y divide-border rounded-lg border border-border">
      {#each collections as collection}
        <a
          href="/collections/{collection.id}"
          class="flex items-center justify-between px-4 py-4 hover:bg-muted/50"
        >
          <div>
            <h3 class="font-medium">{collection.name}</h3>
            <p class="text-sm text-muted-foreground">
              {collection.influxCount} influx{collection.influxCount === 1
                ? ""
                : "es"} ·
              {collection.connectionCount} client{collection.connectionCount ===
              1
                ? ""
                : "s"}
            </p>
          </div>
          <span class="text-sm text-muted-foreground">→</span>
        </a>
      {/each}
    </div>
  {/if}
</div>
