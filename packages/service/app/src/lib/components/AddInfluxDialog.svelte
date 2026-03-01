<script lang="ts">
  // @ts-nocheck
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import * as Command from "$lib/components/ui/command";
  import * as Dialog from "$lib/components/ui/dialog";
  import { SOURCE_TYPE_LABELS } from "$lib/domain/source";
  import {
    probeAllSources,
    refreshSourceDataSources,
    type DataSourceInfo,
    type SourceWithDataSources,
  } from "$lib/remote/influxes.remote";
  import { SourceType } from "@contfu/core";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Check from "@lucide/svelte/icons/check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  interface Props {
    /** IDs of source collections already linked to this collection */
    linkedSourceCollectionIds: Set<number>;
    /** Refs of source collections already linked (for filtering custom path options) */
    linkedSourceCollectionRefs: Set<string>;
    onSelect: (selection: { source: SourceWithDataSources; dataSource: DataSourceInfo }) => void;
  }

  let {
    linkedSourceCollectionIds,
    linkedSourceCollectionRefs,
    onSelect,
  }: Props = $props();

  // Dialog state
  let open = $state(false);

  // Data loading
  let sourcesPromise = $state<Promise<SourceWithDataSources[]> | null>(null);
  let refreshingSourceId = $state<number | null>(null);
  let refreshErrorBySourceId = $state<Map<number, string>>(new Map());

  function handleOpen() {
    open = true;
    refreshErrorBySourceId = new Map();

    // Start probing sources
    sourcesPromise = probeAllSources();
  }

  function handleClose() {
    open = false;
  }

  function isAlreadyLinked(ds: DataSourceInfo): boolean {
    return (
      ds.exists &&
      ds.sourceCollectionId !== undefined &&
      linkedSourceCollectionIds.has(ds.sourceCollectionId)
    );
  }

  function handleSelectDataSource(
    source: SourceWithDataSources,
    ds: DataSourceInfo,
  ) {
    if (isAlreadyLinked(ds)) return;

    onSelect({ source, dataSource: ds });
    open = false;
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
    if (
      source.dataSources.some(
        (ds) =>
          ds.id.toLowerCase() === filter || ds.title.toLowerCase() === filter,
      )
    ) {
      return true;
    }
    return linkedSourceCollectionRefs.has(searchFilter.trim());
  }

  // Refresh collections for a specific source
  async function handleRefreshSource(sourceId: number) {
    if (refreshingSourceId === sourceId) {
      return;
    }

    refreshingSourceId = sourceId;
    refreshErrorBySourceId.delete(sourceId);
    refreshErrorBySourceId = refreshErrorBySourceId;

    try {
      const result = await refreshSourceDataSources({ sourceId });

      if (result.success) {
        sourcesPromise = probeAllSources();
        await sourcesPromise;
      } else {
        refreshErrorBySourceId.set(sourceId, result.error);
        refreshErrorBySourceId = refreshErrorBySourceId;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to refresh";
      refreshErrorBySourceId.set(sourceId, errorMsg);
      refreshErrorBySourceId = refreshErrorBySourceId;
    } finally {
      refreshingSourceId = null;
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(isOpen) => {
    if (!isOpen) handleClose();
  }}
>
  <Dialog.Trigger
    class="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    onclick={handleOpen}
  >
    <Plus class="h-4 w-4" />
    Add Influx
  </Dialog.Trigger>

  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Add Influx</Dialog.Title>
      <Dialog.Description>
        Select a data source to add to this collection.
      </Dialog.Description>
    </Dialog.Header>

    <!-- Data Source Selection -->
      {#if sourcesPromise}
        {#await sourcesPromise}
          <div class="flex items-center justify-center py-12">
            <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
            <span class="ml-2 text-sm text-muted-foreground"
              >Loading data sources...</span
            >
          </div>
        {:then sources}
          {#if sources.length === 0}
            <div class="py-8 text-center text-muted-foreground">
              <p>No sources configured.</p>
              <p class="mt-1 text-sm">Add a source first to import data.</p>
            </div>
          {:else}
            <Command.Root class="border rounded-lg" shouldFilter={false}>
              <Command.Input
                placeholder="Search data sources..."
                bind:value={searchFilter}
              />
              <Command.List class="max-h-[300px]">
                <Command.Empty>No data sources found.</Command.Empty>

                {#each sources as source}
                  {@const hasDataSources = source.dataSources.length > 0}
                  {@const showAddCustom =
                    source.allowCustomPath &&
                    searchFilter.trim() &&
                    !filterMatchesExisting(source)}
                  {@const filter = searchFilter.trim().toLowerCase()}
                  {@const filteredDataSources = filter
                    ? source.dataSources.filter(
                        (ds) =>
                          ds.id.toLowerCase().includes(filter) ||
                          ds.title.toLowerCase().includes(filter),
                      )
                    : source.dataSources}

                  <Command.Group>
                    <!-- Custom heading with icon -->
                    <div
                      class="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      <SourceTypeIcon
                        type={source.sourceType}
                        class="h-4 w-4"
                      />
                      <span class="flex-1"
                        >{source.sourceName ??
                          SOURCE_TYPE_LABELS[source.sourceType]}</span
                      >
                      {#if source.sourceType === SourceType.NOTION}
                        {@const isRefreshing =
                          refreshingSourceId === source.sourceId}
                        <button
                          type="button"
                          onclick={() => handleRefreshSource(source.sourceId)}
                          disabled={isRefreshing}
                          title="Refresh collections from source"
                          class="inline-flex items-center justify-center rounded-sm p-1 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {#if isRefreshing}
                            <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
                          {:else}
                            <RefreshCw class="h-3.5 w-3.5" />
                          {/if}
                        </button>
                      {/if}
                    </div>

                    {#if source.error}
                      <div
                        class="flex items-center gap-2 px-2 py-3 text-sm text-destructive"
                      >
                        <AlertCircle class="h-4 w-4" />
                        {source.error}
                      </div>
                    {/if}

                    {@const refreshError = refreshErrorBySourceId.get(
                      source.sourceId,
                    )}
                    {#if refreshError}
                      <div
                        class="flex items-center gap-2 px-2 py-3 text-sm text-destructive bg-destructive/10 border-l-2 border-destructive"
                      >
                        <AlertCircle class="h-4 w-4" />
                        <span>Failed to refresh: {refreshError}</span>
                      </div>
                    {/if}

                    {#if refreshingSourceId === source.sourceId}
                      <div
                        class="flex items-center gap-2 py-3 pl-6 pr-2 text-sm text-muted-foreground"
                      >
                        <LoaderCircle class="h-4 w-4 animate-spin" />
                        Refreshing collections...
                      </div>
                    {:else if !source.error && filteredDataSources.length === 0 && !showAddCustom}
                      <div class="py-3 pl-6 pr-2 text-sm text-muted-foreground">
                        No data sources found.
                      </div>
                    {:else}
                      {#each filteredDataSources as ds}
                        {@const linked = isAlreadyLinked(ds)}
                        <Command.Item
                          value={`${source.sourceName} ${ds.title} ${ds.id}`}
                          disabled={linked}
                          onSelect={() => handleSelectDataSource(source, ds)}
                          class="{linked ? 'opacity-50' : ''} pl-6"
                        >
                          {#if ds.icon?.type === "emoji"}
                            <span>{ds.icon.value}</span>
                          {:else}
                            <SourceTypeIcon
                              type={source.sourceType}
                              class="h-4 w-4 text-muted-foreground"
                            />
                          {/if}
                          <span class="flex-1 truncate">{ds.title}</span>
                          {#if linked}
                            <span
                              class="ml-2 flex items-center gap-1 text-xs text-muted-foreground"
                            >
                              <Check class="h-3 w-3" />
                              linked
                            </span>
                          {:else if ds.exists}
                            <span class="ml-2 text-xs text-muted-foreground"
                              >existing</span
                            >
                          {/if}
                        </Command.Item>
                      {/each}

                      {#if showAddCustom}
                        <!-- Add custom path option for Web sources -->
                        <Command.Item
                          value={`add-custom-${source.sourceId}`}
                          onSelect={() => handleAddCustomWebPath(source)}
                          class="pl-6"
                        >
                          <Plus class="h-4 w-4 text-muted-foreground" />
                          <span class="flex-1">Add "{searchFilter.trim()}"</span
                          >
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
  </Dialog.Content>
</Dialog.Root>
