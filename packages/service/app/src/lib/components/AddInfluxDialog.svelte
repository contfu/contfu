<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Command from "$lib/components/ui/command";
  import FilterEditor from "$lib/components/FilterEditor.svelte";
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import {
    probeAllSources,
    addInfluxWithAutoCreate,
    type DataSourceInfo,
    type SourceWithDataSources,
  } from "$lib/remote/influxes.remote";
  import { getSourceCollectionSchemaQuery } from "$lib/remote/collections.remote";
  import { SourceType } from "@contfu/svc-backend/features/sources/testSourceConnection";
  import type { Filter, CollectionSchema } from "@contfu/core";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Plus from "@lucide/svelte/icons/plus";

  interface Props {
    collectionId: number;
    /** IDs of source collections already linked to this collection */
    linkedSourceCollectionIds: Set<number>;
    /** Refs of source collections already linked (for filtering custom path options) */
    linkedSourceCollectionRefs: Set<string>;
    onSuccess?: () => void;
  }

  let { collectionId, linkedSourceCollectionIds, linkedSourceCollectionRefs, onSuccess }: Props = $props();

  // Dialog state
  let open = $state(false);
  let step = $state<"select" | "configure">("select");

  // Selection state
  let selectedSource = $state<SourceWithDataSources | null>(null);
  let selectedDataSource = $state<DataSourceInfo | null>(null);

  // Filter configuration state
  let schema = $state<CollectionSchema | null>(null);
  let filters = $state<Filter[]>([]);
  let loadingSchema = $state(false);

  // Submit state
  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  // Data loading
  let sourcesPromise = $state<Promise<SourceWithDataSources[]> | null>(null);

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    [SourceType.NOTION]: "Notion",
    [SourceType.STRAPI]: "Strapi",
    [SourceType.WEB]: "Web",
  };

  function handleOpen() {
    open = true;
    step = "select";
    selectedSource = null;
    selectedDataSource = null;
    schema = null;
    filters = [];
    submitError = null;

    // Start probing sources
    sourcesPromise = probeAllSources();
  }

  function handleClose() {
    open = false;
  }

  function isAlreadyLinked(ds: DataSourceInfo): boolean {
    return ds.exists && ds.sourceCollectionId !== undefined && linkedSourceCollectionIds.has(ds.sourceCollectionId);
  }

  async function handleSelectDataSource(source: SourceWithDataSources, ds: DataSourceInfo) {
    if (isAlreadyLinked(ds)) return;

    selectedSource = source;
    selectedDataSource = ds;
    step = "configure";
    submitError = null;

    // Use schema from probe results if available (Notion includes it)
    if (ds.schema) {
      schema = ds.schema;
      loadingSchema = false;
    } else if (ds.exists && ds.sourceCollectionId) {
      // For existing source collections without inline schema, fetch from DB
      loadingSchema = true;
      try {
        schema = await getSourceCollectionSchemaQuery({ sourceCollectionId: ds.sourceCollectionId });
      } catch {
        schema = null;
      }
      loadingSchema = false;
    } else {
      // No schema available
      schema = null;
      loadingSchema = false;
    }
  }

  function handleBack() {
    step = "select";
    selectedSource = null;
    selectedDataSource = null;
    schema = null;
    filters = [];
    submitError = null;
  }

  function handleFilterChange(newFilters: Filter[]) {
    filters = newFilters;
  }

  async function handleSubmit() {
    if (!selectedSource || !selectedDataSource) return;

    submitting = true;
    submitError = null;

    const result = await addInfluxWithAutoCreate({
      collectionId,
      sourceId: selectedSource.sourceId,
      ref: selectedDataSource.id,
      name: selectedDataSource.title,
      existingSourceCollectionId: selectedDataSource.exists ? selectedDataSource.sourceCollectionId : undefined,
      filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
      schema: schema ? JSON.stringify(schema) : undefined,
    });

    submitting = false;

    if (result.success) {
      open = false;
      await invalidateAll();
      onSuccess?.();
    } else {
      submitError = result.error;
    }
  }

  // Search filter for command input
  let searchFilter = $state("");

  // Web source: create custom path from search filter
  function handleAddCustomWebPath(source: SourceWithDataSources) {
    const path = searchFilter.trim();
    if (!path) return;

    const ds: DataSourceInfo = {
      id: path,
      title: path,
      icon: null,
      schema: null,
      exists: false,
    };

    handleSelectDataSource(source, ds);
    searchFilter = "";
  }

  // Check if search filter matches any existing data source or already-linked ref
  function filterMatchesExisting(source: SourceWithDataSources): boolean {
    const filter = searchFilter.trim().toLowerCase();
    if (!filter) return false;
    // Check against data sources from probe
    if (source.dataSources.some(
      (ds) => ds.id.toLowerCase() === filter || ds.title.toLowerCase() === filter
    )) {
      return true;
    }
    // Also check against already-linked refs (for custom paths that aren't in probe results)
    return linkedSourceCollectionRefs.has(searchFilter.trim());
  }
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
  <Dialog.Trigger
    class="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    onclick={handleOpen}
  >
    <Plus class="h-4 w-4" />
    Add Influx
  </Dialog.Trigger>

  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>
        {#if step === "select"}
          Add Influx
        {:else}
          Configure Influx
        {/if}
      </Dialog.Title>
      <Dialog.Description>
        {#if step === "select"}
          Select a data source to add to this collection.
        {:else if selectedDataSource}
          Configure filters for "{selectedDataSource.title}".
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    {#if step === "select"}
      <!-- Data Source Selection -->
      {#if sourcesPromise}
        {#await sourcesPromise}
          <div class="flex items-center justify-center py-12">
            <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
            <span class="ml-2 text-sm text-muted-foreground">Loading data sources...</span>
          </div>
        {:then sources}
          {#if sources.length === 0}
            <div class="py-8 text-center text-muted-foreground">
              <p>No sources configured.</p>
              <p class="mt-1 text-sm">Add a source first to import data.</p>
            </div>
          {:else}
            <Command.Root class="border rounded-lg" shouldFilter={false}>
              <Command.Input placeholder="Search data sources..." bind:value={searchFilter} />
              <Command.List class="max-h-[300px]">
                <Command.Empty>No data sources found.</Command.Empty>

                {#each sources as source}
                  {@const hasDataSources = source.dataSources.length > 0}
                  {@const showAddCustom = source.allowCustomPath && searchFilter.trim() && !filterMatchesExisting(source)}
                  {@const filter = searchFilter.trim().toLowerCase()}
                  {@const filteredDataSources = filter ? source.dataSources.filter(ds => 
                    ds.id.toLowerCase().includes(filter) || 
                    ds.title.toLowerCase().includes(filter)
                  ) : source.dataSources}

                  <Command.Group>
                    <!-- Custom heading with icon -->
                    <div class="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      <SourceTypeIcon type={source.sourceType} class="h-4 w-4" />
                      {source.sourceName ?? SOURCE_TYPE_LABELS[source.sourceType]}
                    </div>

                    {#if source.error}
                      <div class="flex items-center gap-2 px-2 py-3 text-sm text-destructive">
                        <AlertCircle class="h-4 w-4" />
                        {source.error}
                      </div>
                    {:else if filteredDataSources.length === 0 && !showAddCustom}
                      <div class="px-2 py-3 text-sm text-muted-foreground">
                        No data sources found.
                      </div>
                    {:else}
                      {#each filteredDataSources as ds}
                        {@const linked = isAlreadyLinked(ds)}
                        <Command.Item
                          value={`${source.sourceName} ${ds.title} ${ds.id}`}
                          disabled={linked}
                          onSelect={() => handleSelectDataSource(source, ds)}
                          class={linked ? "opacity-50" : ""}
                        >
                          {#if ds.icon?.type === "emoji"}
                            <span class="mr-2">{ds.icon.value}</span>
                          {:else}
                            <SourceTypeIcon type={source.sourceType} class="mr-2 h-4 w-4 text-muted-foreground" />
                          {/if}
                          <span class="flex-1 truncate">{ds.title}</span>
                          {#if linked}
                            <span class="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Check class="h-3 w-3" />
                              linked
                            </span>
                          {:else if ds.exists}
                            <span class="ml-2 text-xs text-muted-foreground">existing</span>
                          {/if}
                        </Command.Item>
                      {/each}

                      {#if showAddCustom}
                        <!-- Add custom path option for Web sources -->
                        <Command.Item
                          value={`add-custom-${source.sourceId}`}
                          onSelect={() => handleAddCustomWebPath(source)}
                        >
                          <Plus class="mr-2 h-4 w-4 text-muted-foreground" />
                          <span class="flex-1">Add "{searchFilter.trim()}"</span>
                          <span class="text-xs text-muted-foreground">new</span>
                        </Command.Item>
                      {/if}
                    {/if}
                  </Command.Group>
                {/each}
              </Command.List>
            </Command.Root>
          {/if}
        {:catch error}
          <div class="flex flex-col items-center gap-2 py-8 text-destructive">
            <AlertCircle class="h-6 w-6" />
            <p>Failed to load data sources</p>
            <p class="text-sm">{error.message}</p>
          </div>
        {/await}
      {/if}
    {:else}
      <!-- Filter Configuration -->
      <div class="space-y-4">
        <button
          type="button"
          onclick={handleBack}
          class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft class="h-4 w-4" />
          Back to selection
        </button>

        {#if selectedDataSource}
          <div class="rounded-md border border-border bg-muted/30 p-3">
            <div class="flex items-center gap-2">
              {#if selectedDataSource.icon?.type === "emoji"}
                <span>{selectedDataSource.icon.value}</span>
              {:else if selectedSource}
                <SourceTypeIcon type={selectedSource.sourceType} class="h-4 w-4 text-muted-foreground" />
              {/if}
              <span class="font-medium">{selectedDataSource.title}</span>
              {#if !selectedDataSource.exists}
                <span class="ml-auto text-xs text-muted-foreground">New source collection</span>
              {/if}
            </div>
          </div>
        {/if}

        <div>
          <h3 class="mb-2 text-sm font-medium">Filters (optional)</h3>
          {#if loadingSchema}
            <div class="flex items-center gap-2 py-4 text-muted-foreground">
              <LoaderCircle class="h-4 w-4 animate-spin" />
              <span class="text-sm">Loading schema...</span>
            </div>
          {:else}
            <FilterEditor
              {schema}
              {filters}
              onchange={handleFilterChange}
            />
          {/if}
        </div>

        {#if submitError}
          <div class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle class="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        {/if}
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={handleClose}>Cancel</Button>
        <Button onclick={handleSubmit} disabled={submitting}>
          {#if submitting}
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            Adding...
          {:else}
            Add Influx
          {/if}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
