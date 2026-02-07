<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import AddInfluxDialog from "$lib/components/AddInfluxDialog.svelte";
  import FilterEditor from "$lib/components/FilterEditor.svelte";
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import {
    deleteCollection,
    getCollection,
    getSourceCollectionSchemaQuery,
    updateCollection,
  } from "$lib/remote/collections.remote";
  import {
    getInfluxes,
    removeInflux,
    updateInfluxForm,
  } from "$lib/remote/influxes.remote";
  import {
    addConnection,
    getConnectionsByCollection,
    removeConnection,
  } from "$lib/remote/connections.remote";
  import { getConsumers } from "$lib/remote/consumers.remote";
  import { cn } from "$lib/utils";
  import type { CollectionSchema, Filter as FilterType } from "@contfu/core";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FilterIcon from "@lucide/svelte/icons/filter";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";

  const nameId = useId();

  const id = Number.parseInt(page.params.id ?? "", 10);
  const collection = Number.isNaN(id) ? null : await getCollection({ id });

  if (!collection) {
    goto("/collections");
  }

  // Make influxes reactive so they can be refreshed
  let influxes = $state(
    collection ? await getInfluxes({ collectionId: id }) : [],
  );

  // Derived: linked source IDs for the dialog
  const linkedSourceIds = $derived(
    new Set(influxes.map((m) => m.sourceCollectionId)),
  );

  // Derived: linked source refs for filtering "Add custom path" options
  const linkedSourceRefs = $derived(
    new Set(
      influxes
        .map((m) => m.sourceCollectionRef)
        .filter((r): r is string => r !== null),
    ),
  );

  // Refresh influxes after adding an influx
  async function refreshInfluxes() {
    if (collection) {
      influxes = await getInfluxes({ collectionId: id });
    }
  }

  // Consumer connections
  let connections = $state(
    collection ? await getConnectionsByCollection({ collectionId: id }) : [],
  );
  const allConsumers = collection ? await getConsumers() : [];

  const connectedConsumerIds = $derived(
    new Set(connections.map((c) => c.consumerId)),
  );
  const availableConsumers = $derived(
    allConsumers.filter((c) => !connectedConsumerIds.has(c.id)),
  );

  let selectedConsumerId = $state<number | null>(null);

  // Initialize selected consumer after availableConsumers is computed
  $effect(() => {
    if (selectedConsumerId === null && availableConsumers.length > 0) {
      selectedConsumerId = availableConsumers[0].id;
    }
  });

  async function refreshConnections() {
    if (collection) {
      connections = await getConnectionsByCollection({ collectionId: id });
    }
  }

  let updateSuccess = $state(false);
  let filterUpdateSuccess = $state(false);
  let connectionSuccess = $state(false);
  let namePopoverOpen = $state(false);

  // Track expanded influxes for filter editing
  let expandedInfluxes = $state<Set<number>>(new Set());

  // Cache schemas for source collections
  let schemaCache = $state<Map<number, CollectionSchema | null>>(new Map());

  // Track filter edits per influx
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
    if (updateCollection.result?.success) {
      handleUpdateSuccess();
      namePopoverOpen = false;
    }
  });

  $effect(() => {
    if (updateInfluxForm.result?.success) {
      handleFilterUpdateSuccess();
      // Reset edit state after successful save
      filterEdits = new Map();
    }
  });

  $effect(() => {
    if (addConnection.result?.success || removeConnection.result?.success) {
      connectionSuccess = true;
      refreshConnections();
      setTimeout(() => {
        connectionSuccess = false;
      }, 3000);
    }
  });

  async function toggleInflux(sourceCollectionId: number) {
    const newExpanded = new Set(expandedInfluxes);
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
        const schema = await getSourceCollectionSchemaQuery({
          sourceCollectionId,
        });
        schemaCache = new Map(schemaCache).set(sourceCollectionId, schema);
      }
    }
    expandedInfluxes = newExpanded;
  }

  function getFiltersForInflux(sourceCollectionId: number): FilterType[] {
    // Return edited filters if available, otherwise the original
    if (filterEdits.has(sourceCollectionId)) {
      return filterEdits.get(sourceCollectionId)!;
    }
    const influx = influxes.find(
      (m) => m.sourceCollectionId === sourceCollectionId,
    );
    return influx?.filters ?? [];
  }

  function handleFilterChange(
    sourceCollectionId: number,
    newFilters: FilterType[],
  ) {
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
      <a
        href="/collections"
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Collections
      </a>
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">{collection.name}</h1>
        <Popover.Root bind:open={namePopoverOpen}>
          <Popover.Trigger
            class={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Pencil class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="w-72" align="start">
              <form {...updateCollection} class="space-y-3">
                <input
                  {...updateCollection.fields?.id.as("number")}
                  type="hidden"
                  value={collection.id}
                />
                <div class="space-y-1.5">
                  <Label for={nameId}>Name</Label>
                  <Input
                    id={nameId}
                    {...updateCollection.fields?.name.as("text")}
                    value={collection.name}
                    required
                  />
                </div>
                <div class="flex justify-end gap-2">
                  <Popover.Close>
                    <Button type="button" variant="outline" size="sm"
                      >Cancel</Button
                    >
                  </Popover.Close>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!!updateCollection.pending}
                  >
                    {updateCollection.pending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        {collection.influxCount} influx{collection.influxCount === 1
          ? ""
          : "es"} ·
        {collection.connectionCount} consumer{collection.connectionCount === 1
          ? ""
          : "s"}
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

    <!-- Influxes -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Influxes
        </h2>
        <AddInfluxDialog
          collectionId={collection.id}
          linkedSourceCollectionIds={linkedSourceIds}
          linkedSourceCollectionRefs={linkedSourceRefs}
          onSuccess={refreshInfluxes}
        />
      </div>

      {#if influxes.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">
          No influxes configured yet. Add one to start receiving content.
        </p>
      {:else}
        <div class="mb-4 space-y-2">
          {#each influxes as influx}
            {@const remove = removeInflux.for(
              influx.sourceCollectionId,
            )}
            <div class="rounded-md border border-border">
              <!-- Influx header -->
              <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-3">
                  <SourceTypeIcon
                    type={influx.sourceType}
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <button
                    type="button"
                    class="flex items-center gap-2 text-sm font-medium hover:text-primary"
                    onclick={() => toggleInflux(influx.sourceCollectionId)}
                  >
                    {#if expandedInfluxes.has(influx.sourceCollectionId)}
                      <ChevronUp class="h-4 w-4" />
                    {:else}
                      <ChevronDown class="h-4 w-4" />
                    {/if}
                    <span>
                      {#if influx.sourceName}
                        <span class="text-muted-foreground"
                          >{influx.sourceName} /</span
                        >
                      {/if}
                      {influx.sourceCollectionName}
                    </span>
                  </button>
                  <span
                    class="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <FilterIcon class="h-3 w-3" />
                    {formatFilterCount(
                      getFiltersForInflux(influx.sourceCollectionId),
                    )}
                  </span>
                </div>
                <form {...remove}>
                  <input
                    {...remove.fields?.collectionId.as("number")}
                    type="hidden"
                    value={collection.id}
                  />
                  <input
                    {...remove.fields?.sourceCollectionId.as("number")}
                    type="hidden"
                    value={influx.sourceCollectionId}
                  />
                  <button
                    type="submit"
                    class="text-sm text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>

              <!-- Expanded filter editor -->
              {#if expandedInfluxes.has(influx.sourceCollectionId)}
                <div class="border-t border-border bg-muted/20 px-4 py-4">
                  <h3 class="mb-3 text-sm font-medium">Filters</h3>
                  <FilterEditor
                    schema={schemaCache.get(influx.sourceCollectionId) ?? null}
                    filters={getFiltersForInflux(influx.sourceCollectionId)}
                    onchange={(filters) =>
                      handleFilterChange(influx.sourceCollectionId, filters)}
                  />

                  {#if hasUnsavedChanges(influx.sourceCollectionId)}
                    <div class="mt-4 flex gap-2">
                      <form {...updateInfluxForm}>
                        <input
                          {...updateInfluxForm.fields?.collectionId.as(
                            "number",
                          )}
                          type="hidden"
                          value={collection.id}
                        />
                        <input
                          {...updateInfluxForm.fields?.sourceCollectionId.as(
                            "number",
                          )}
                          type="hidden"
                          value={influx.sourceCollectionId}
                        />
                        <input
                          {...updateInfluxForm.fields?.filters.as(
                            "text",
                          )}
                          type="hidden"
                          value={JSON.stringify(
                            filterEdits.get(influx.sourceCollectionId) ?? [],
                          )}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!!updateInfluxForm.pending}
                        >
                          {updateInfluxForm.pending
                            ? "Saving..."
                            : "Save Filters"}
                        </Button>
                      </form>
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => {
                          const newEdits = new Map(filterEdits);
                          newEdits.delete(influx.sourceCollectionId);
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
    </section>

    <!-- Consumers -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Consumers
      </h2>

      {#if connectionSuccess}
        <Alert.Root class="mb-4">
          <Alert.Description>Consumer connection updated.</Alert.Description>
        </Alert.Root>
      {/if}

      {#if connections.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">
          No consumers linked yet.
        </p>
      {:else}
        <div
          class="mb-4 divide-y divide-border rounded-md border border-border"
        >
          {#each connections as connection}
            <div class="flex items-center justify-between px-4 py-3">
              <a
                href="/consumers/{connection.consumerId}"
                class="text-sm font-medium hover:underline"
              >
                {connection.consumerName || "Unnamed Consumer"}
              </a>
              <form {...removeConnection}>
                <input
                  {...removeConnection.fields?.consumerId.as("number")}
                  type="hidden"
                  value={connection.consumerId}
                />
                <input
                  {...removeConnection.fields?.collectionId.as("number")}
                  type="hidden"
                  value={collection.id}
                />
                <button
                  type="submit"
                  class="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              </form>
            </div>
          {/each}
        </div>
      {/if}

      {#if availableConsumers.length > 0}
        <form {...addConnection} class="flex gap-2">
          <input
            {...addConnection.fields?.collectionId.as("number")}
            type="hidden"
            value={collection.id}
          />
          <select
            {...addConnection.fields?.consumerId.as("number")}
            class="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            bind:value={selectedConsumerId}
          >
            {#each availableConsumers as consumer}
              <option value={consumer.id}
                >{consumer.name || "Unnamed Consumer"}</option
              >
            {/each}
          </select>
          <Button type="submit" variant="outline" size="sm"
            >Link Consumer</Button
          >
        </form>
      {:else if allConsumers.length === 0}
        <p class="text-sm text-muted-foreground">
          No consumers available. <a
            href="/consumers/new"
            class="text-primary hover:underline">Create one</a
          > first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">All consumers are linked.</p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-destructive"
      >
        Danger Zone
      </h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Deleting this collection will remove all influxes and consumer
        connections.
      </p>
      <form {...deleteCollection}>
        <input
          {...deleteCollection.fields?.id.as("number")}
          type="hidden"
          value={collection.id}
        />
        <Button type="submit" variant="destructive" size="sm"
          >Delete Collection</Button
        >
      </form>
    </section>
  </div>
{/if}
