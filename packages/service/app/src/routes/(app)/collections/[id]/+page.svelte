<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import {
    getCollection,
    updateCollection,
    deleteCollection,
    getSourceCollectionMappings,
    addSourceCollection,
    removeSourceCollection,
    updateSourceCollectionMapping,
    getSourceCollectionSchemaQuery,
  } from "$lib/remote/collections.remote";
  import { getSourceCollections } from "$lib/remote/source-collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Alert from "$lib/components/ui/alert";
  import * as Dialog from "$lib/components/ui/dialog";
  import FilterEditor from "$lib/components/FilterEditor.svelte";
  import type { Filter as FilterType, CollectionSchema } from "@contfu/core";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FilterIcon from "@lucide/svelte/icons/filter";

  const id = Number.parseInt(page.params.id ?? "", 10);
  const collection = Number.isNaN(id) ? null : await getCollection({ id });

  if (!collection) {
    goto("/collections");
  }

  const mappings = collection ? await getSourceCollectionMappings({ collectionId: id }) : [];
  const allSourceCollections = collection ? await getSourceCollections() : [];

  const linkedSourceIds = new Set(mappings.map((m) => m.sourceCollectionId));
  const availableSourceCollections = allSourceCollections.filter(
    (sc) => !linkedSourceIds.has(sc.id),
  );

  let updateSuccess = $state(false);
  let filterUpdateSuccess = $state(false);

  // Track expanded mappings for filter editing
  let expandedMappings = $state<Set<number>>(new Set());
  
  // Cache schemas for source collections
  let schemaCache = $state<Map<number, CollectionSchema | null>>(new Map());
  
  // Track filter edits per mapping
  let filterEdits = $state<Map<number, FilterType[]>>(new Map());

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }

  function handleFilterUpdateSuccess() {
    filterUpdateSuccess = true;
    setTimeout(() => {
      filterUpdateSuccess = false;
    }, 3000);
  }

  $effect(() => {
    if (updateCollection.result?.success) handleUpdateSuccess();
  });

  $effect(() => {
    if (updateSourceCollectionMapping.result?.success) {
      handleFilterUpdateSuccess();
      // Reset edit state after successful save
      filterEdits = new Map();
    }
  });

  async function toggleMapping(sourceCollectionId: number) {
    const newExpanded = new Set(expandedMappings);
    if (newExpanded.has(sourceCollectionId)) {
      newExpanded.delete(sourceCollectionId);
      // Clear any unsaved edits
      const newEdits = new Map(filterEdits);
      newEdits.delete(sourceCollectionId);
      filterEdits = newEdits;
    } else {
      newExpanded.add(sourceCollectionId);
      // Load schema if not cached
      if (!schemaCache.has(sourceCollectionId)) {
        const schema = await getSourceCollectionSchemaQuery({ sourceCollectionId });
        schemaCache = new Map(schemaCache).set(sourceCollectionId, schema);
      }
    }
    expandedMappings = newExpanded;
  }

  function getFiltersForMapping(sourceCollectionId: number): FilterType[] {
    // Return edited filters if available, otherwise the original
    if (filterEdits.has(sourceCollectionId)) {
      return filterEdits.get(sourceCollectionId)!;
    }
    const mapping = mappings.find((m) => m.sourceCollectionId === sourceCollectionId);
    return mapping?.filters ?? [];
  }

  function handleFilterChange(sourceCollectionId: number, newFilters: FilterType[]) {
    filterEdits = new Map(filterEdits).set(sourceCollectionId, newFilters);
  }

  function hasUnsavedChanges(sourceCollectionId: number): boolean {
    return filterEdits.has(sourceCollectionId);
  }

  function formatFilterCount(filters: FilterType[] | null): string {
    const count = filters?.length ?? 0;
    if (count === 0) return "No filters";
    return `${count} filter${count === 1 ? "" : "s"}`;
  }
</script>

{#if collection}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/collections" class="text-sm text-muted-foreground hover:text-foreground">
        ← Collections
      </a>
    </div>

    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">{collection.name}</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {collection.influxCount} influx{collection.influxCount === 1 ? "" : "es"} ·
        {collection.connectionCount} client{collection.connectionCount === 1 ? "" : "s"}
      </p>
    </div>

    {#if updateSuccess}
      <Alert.Root class="mb-6">
        <Alert.Description>Collection updated successfully.</Alert.Description>
      </Alert.Root>
    {/if}

    {#if filterUpdateSuccess}
      <Alert.Root class="mb-6">
        <Alert.Description>Filters updated successfully.</Alert.Description>
      </Alert.Root>
    {/if}

    <!-- Update form -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Settings</h2>
      <form method="post" action={updateCollection.action} class="space-y-4">
        <input type="hidden" name="id" value={collection.id} />
        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" name="name" type="text" value={collection.name} required />
        </div>
        <Button type="submit" size="sm" disabled={!!updateCollection.pending}>
          {updateCollection.pending ? "Saving..." : "Save"}
        </Button>
      </form>
    </section>

    <!-- Source Collections -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Source Collections
      </h2>

      {#if mappings.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">No source collections linked yet.</p>
      {:else}
        <div class="mb-4 space-y-2">
          {#each mappings as mapping}
            <div class="rounded-md border border-border">
              <!-- Mapping header -->
              <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="flex items-center gap-2 text-sm font-medium hover:text-primary"
                    onclick={() => toggleMapping(mapping.sourceCollectionId)}
                  >
                    {#if expandedMappings.has(mapping.sourceCollectionId)}
                      <ChevronUp class="h-4 w-4" />
                    {:else}
                      <ChevronDown class="h-4 w-4" />
                    {/if}
                    {mapping.sourceCollectionName}
                  </button>
                  <span class="flex items-center gap-1 text-xs text-muted-foreground">
                    <FilterIcon class="h-3 w-3" />
                    {formatFilterCount(getFiltersForMapping(mapping.sourceCollectionId))}
                  </span>
                </div>
                <form method="post" action={removeSourceCollection.action}>
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <input type="hidden" name="sourceCollectionId" value={mapping.sourceCollectionId} />
                  <button type="submit" class="text-sm text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              </div>

              <!-- Expanded filter editor -->
              {#if expandedMappings.has(mapping.sourceCollectionId)}
                <div class="border-t border-border bg-muted/20 px-4 py-4">
                  <h3 class="mb-3 text-sm font-medium">Filters</h3>
                  <FilterEditor
                    schema={schemaCache.get(mapping.sourceCollectionId) ?? null}
                    filters={getFiltersForMapping(mapping.sourceCollectionId)}
                    onchange={(filters) => handleFilterChange(mapping.sourceCollectionId, filters)}
                  />
                  
                  {#if hasUnsavedChanges(mapping.sourceCollectionId)}
                    <div class="mt-4 flex gap-2">
                      <form method="post" action={updateSourceCollectionMapping.action}>
                        <input type="hidden" name="collectionId" value={collection.id} />
                        <input type="hidden" name="sourceCollectionId" value={mapping.sourceCollectionId} />
                        <input
                          type="hidden"
                          name="filters"
                          value={JSON.stringify(filterEdits.get(mapping.sourceCollectionId) ?? [])}
                        />
                        <Button type="submit" size="sm" disabled={!!updateSourceCollectionMapping.pending}>
                          {updateSourceCollectionMapping.pending ? "Saving..." : "Save Filters"}
                        </Button>
                      </form>
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => {
                          const newEdits = new Map(filterEdits);
                          newEdits.delete(mapping.sourceCollectionId);
                          filterEdits = newEdits;
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if availableSourceCollections.length > 0}
        <p class="mb-2 text-sm text-muted-foreground">
          Link source collections from your sources:
        </p>
        <div class="flex flex-wrap gap-2">
          {#each availableSourceCollections as sc}
            <form method="post" action={addSourceCollection.action} class="inline">
              <input type="hidden" name="collectionId" value={collection.id} />
              <input type="hidden" name="sourceCollectionId" value={sc.id} />
              <Button type="submit" variant="outline" size="sm">
                + {sc.name}
              </Button>
            </form>
          {/each}
        </div>
      {:else if allSourceCollections.length === 0}
        <p class="text-sm text-muted-foreground">
          No source collections available. Create collections in your sources first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">All source collections are linked.</p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-destructive">
        Danger Zone
      </h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Deleting this collection will remove all mappings and client connections.
      </p>
      <form method="post" action={deleteCollection.action}>
        <input type="hidden" name="id" value={collection.id} />
        <Button type="submit" variant="destructive" size="sm">Delete Collection</Button>
      </form>
    </section>
  </div>
{/if}
