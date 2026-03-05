<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getCollections } from "$lib/remote/collections.remote";
  import { FoldersIcon, Plus } from "@lucide/svelte";

  const collections = await getCollections();
</script>

<SiteHeader icon={FoldersIcon} title="collections">
  <div class="ml-auto">
    <Button href="/collections/new">
      <Plus class="mr-1 size-3" />
      new
    </Button>
  </div>
</SiteHeader>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu collections --list
  </p>

  {#if collections.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no collections yet</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Create a collection to aggregate content from multiple sources.
      </p>
      <Button href="/collections/new" class="mt-4">
        create collection
      </Button>
    </div>
  {:else}
    <div class="divide-y divide-border border border-border">
      {#each collections as collection}
        <a
          href="/collections/{collection.id}"
          class="flex items-center justify-between px-3 py-3 hover:bg-muted/30 transition-colors duration-100"
        >
          <div>
            <span class="text-sm hover:text-primary transition-colors duration-150">{collection.name}</span>
            <p class="text-xs text-muted-foreground">
              {collection.influxCount} influx{collection.influxCount === 1 ? "" : "es"} ·
              {collection.connectionCount} client{collection.connectionCount === 1 ? "" : "s"}
            </p>
          </div>
          <span class="text-xs text-muted-foreground">></span>
        </a>
      {/each}
    </div>
  {/if}
</div>
