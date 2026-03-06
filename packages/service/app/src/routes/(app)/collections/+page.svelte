<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getCollections } from "$lib/remote/collections.remote";
  import { FoldersIcon, PlusIcon } from "@lucide/svelte";

  const collections = await getCollections();
</script>

<SiteHeader icon={FoldersIcon} title="collections">
  <div class="ml-auto">
    <Button href="/collections/new">
      <PlusIcon class="size-3" />
      <span class="hidden sm:inline">add</span>
    </Button>
  </div>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu collections list
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
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">influxes</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">clients</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each collections as collection}
            <tr class="hover:bg-muted/30 transition-colors duration-100">
              <td class="px-3 py-2">
                <a href="/collections/{collection.id}" class="hover:text-primary transition-colors duration-150">
                  {collection.name}
                </a>
              </td>
              <td class="px-3 py-2 text-right text-muted-foreground">
                {collection.influxCount}
              </td>
              <td class="px-3 py-2 text-right text-muted-foreground">
                {collection.connectionCount}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
