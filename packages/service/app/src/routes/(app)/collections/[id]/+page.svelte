<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import AddInfluxDialog from "$lib/components/AddInfluxDialog.svelte";
  import FilterEditor from "$lib/components/FilterEditor.svelte";
  import MappingEditor from "$lib/components/MappingEditor.svelte";
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Command from "$lib/components/ui/command";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    deleteCollection,
    getCollection,
    getCollections,
    getSourceCollectionSchemaQuery,
    updateCollection,
    updateCollectionSchema,
  } from "$lib/remote/collections.remote";
  import {
    addConsumerCollection,
    getConsumerCollectionsByCollection,
    removeConsumerCollection,
  } from "$lib/remote/consumer-collections.remote";
  import { getConsumers } from "$lib/remote/consumers.remote";
  import {
    addInfluxWithAutoCreate,
    getInfluxes,
    removeInflux,
    updateInfluxForm,
    updateInfluxMappings,
    type DataSourceInfo,
    type SourceWithDataSources,
  } from "$lib/remote/influxes.remote";
  import { cn } from "$lib/utils";
  import { tcToast } from "$lib/utils/toast";
  import type {
    CollectionSchema,
    Filter as FilterType,
    MappingRule,
    RefTargets,
    ServiceConsumerCollectionWithDetails,
  } from "@contfu/svc-core";
  import {
    Check,
    ChevronsUpDown,
    LinkIcon,
    LoaderCircleIcon,
    TrashIcon,
    UnlinkIcon,
  } from "@lucide/svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FilterIcon from "@lucide/svelte/icons/filter";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { toast } from "svelte-sonner";
  import * as v from "valibot";

  const nameId = useId();
  const displayNameId = useId();
  let { params } = $props();

  let id = $derived(params.id);

  // Create parameterless queries at top level so SvelteKit can track their lifecycle.
  // Creating queries inside $derived prevents $effect.pre from running, which causes
  // cache entries to be evicted after resolve, leading to infinite re-fetch loops
  // during client-side navigation.
  const collectionsQuery = getCollections();
  const consumersQuery = getConsumers();

  // Parameterized queries must be in $derived to react to param changes
  const collectionQuery = $derived(getCollection({ id }));
  const influxesQuery = $derived(getInfluxes({ collectionId: params.id }));
  const connectionsQuery = $derived(
    getConsumerCollectionsByCollection({ collectionId: params.id }),
  );

  // Await queries separately
  const collection = $derived(await collectionQuery);
  const allCollections = $derived(await collectionsQuery);
  const allConsumers = $derived(await consumersQuery);

  // Sync form fields when collection changes (guarded to prevent infinite loop)
  let prevCollection: typeof collection;
  $effect(() => {
    if (collection && collection !== prevCollection) {
      prevCollection = collection;
      updateCollection.fields.set(collection);
    }
  });

  // Pending (unsaved) influxes
  interface PendingInflux {
    tempId: string;
    sourceId: string | number;
    sourceType: number;
    sourceName: string | null;
    sourceCollectionName: string;
    ref: string;
    schema: CollectionSchema | null;
    icon: { type: string; value: string } | null;
    existingSourceCollectionId?: string | number;
  }
  let pendingInfluxes = $state<PendingInflux[]>([]);

  // Derived from query.current + pending
  const linkedSourceIds = $derived(
    new Set([
      ...(influxesQuery?.current ?? []).map((m) => m.sourceCollectionId),
      ...(pendingInfluxes
        .filter((p) => p.existingSourceCollectionId !== undefined)
        .map((p) => p.existingSourceCollectionId!)),
    ]),
  );
  const linkedSourceRefs = $derived(
    new Set([
      ...(influxesQuery?.current ?? [])
        .map((m) => m.sourceCollectionRef)
        .filter((r): r is string => r !== null),
      ...pendingInfluxes.map((p) => p.ref),
    ]),
  );
  const connectedConsumerIds = $derived(
    new Set((connectionsQuery?.current ?? []).map((c) => c.consumerId)),
  );
  const availableConsumers = $derived(
    allConsumers.filter((c) => !connectedConsumerIds.has(c.id)),
  );

  function handleAddInflux(selection: { source: SourceWithDataSources; dataSource: DataSourceInfo }) {
    const { source, dataSource } = selection;
    pendingInfluxes = [
      ...pendingInfluxes,
      {
        tempId: crypto.randomUUID(),
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceCollectionName: dataSource.title,
        ref: dataSource.id,
        schema: dataSource.schema,
        icon: dataSource.icon,
        existingSourceCollectionId: dataSource.exists ? dataSource.sourceCollectionId : undefined,
      },
    ];
  }

  function removePendingInflux(tempId: string) {
    pendingInfluxes = pendingInfluxes.filter((p) => p.tempId !== tempId);
  }

  let selectedConsumerId = $state<number | null>(null);
  let namePopoverOpen = $state(false);
  let consumerComboboxOpen = $state(false);

  // Track expanded influxes for filter editing
  let expandedInfluxes = $state<Set<number>>(new Set());

  // Cache schemas for source collections
  let schemaCache = $state<Map<number, CollectionSchema | null>>(new Map());

  // Track filter edits per influx
  let filterEdits = $state<Map<number, FilterType[]>>(new Map());

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
    const influx = (influxesQuery?.current ?? []).find(
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

  // Schema & Mappings state
  let mappingChanges = $state<{
    targetSchema: CollectionSchema;
    influxMappings: Map<string, MappingRule[]>;
    refTargets: RefTargets;
  } | null>(null);
  let savingMappings = $state(false);
  let mappingEditorRef: MappingEditor | undefined;

  function handleMappingChange(changes: {
    targetSchema: CollectionSchema;
    influxMappings: Map<string, MappingRule[]>;
    refTargets: RefTargets;
  }) {
    mappingChanges = changes;
  }

  // Combine server influxes + pending influxes for MappingEditor
  const combinedInfluxes = $derived.by(() => {
    const mapped = (influxesQuery?.current ?? []).map((influx) => ({
      id: influx.id,
      name: influx.sourceCollectionName,
      sourceSchema: influx.schema,
      mappings: influx.mappings ?? [],
    }));
    const pendingMapped = pendingInfluxes.map((p) => ({
      id: p.tempId,
      name: p.sourceCollectionName,
      sourceSchema: p.schema,
      mappings: [] as MappingRule[],
    }));
    return [...mapped, ...pendingMapped];
  });

  async function saveMappings() {
    if ((!mappingChanges && pendingInfluxes.length === 0) || !collection) return;
    if (mappingEditorRef?.hasValidationErrors()) {
      toast.error("Fix validation errors before saving");
      return;
    }
    savingMappings = true;
    try {
      // 1. Create pending influxes on backend
      const createdInfluxMap = new Map<string, { sourceCollectionId: string; influxId: string }>();
      for (const pending of pendingInfluxes) {
        const result = await addInfluxWithAutoCreate({
          collectionId: collection.id,
          sourceId: pending.sourceId,
          ref: pending.ref,
          name: pending.sourceCollectionName,
          existingSourceCollectionId: pending.existingSourceCollectionId,
          schema: pending.schema ? JSON.stringify(pending.schema) : undefined,
        });
        if (result.success) {
          createdInfluxMap.set(pending.tempId, {
            sourceCollectionId: result.sourceCollectionId,
            influxId: result.influxId,
          });
        } else {
          toast.error(`Failed to create influx "${pending.sourceCollectionName}": ${result.error}`);
          savingMappings = false;
          return;
        }
      }

      // 2. Save collection schema (if changed)
      if (mappingChanges) {
        await updateCollectionSchema({
          id: collection.id,
          schema: JSON.stringify(mappingChanges.targetSchema),
          refTargets: JSON.stringify(mappingChanges.refTargets),
        });
      }

      // 3. Save each influx's mappings
      for (const [influxId, rules] of mappingChanges?.influxMappings ?? []) {
        // Check if this is a server influx
        const influx = (influxesQuery?.current ?? []).find((m) => m.id === influxId);
        if (influx) {
          await updateInfluxMappings({
            id: influx.id,
            mappings: JSON.stringify(rules),
          });
          continue;
        }

        // Check if this is a newly created pending influx
        const created = createdInfluxMap.get(influxId);
        if (created) {
          await updateInfluxMappings({
            id: created.influxId,
            mappings: JSON.stringify(rules),
          });
        }
      }

      // 4. Refresh queries first, then clear local state
      // This ensures the server influxes are loaded before we remove
      // pending influxes, preventing a flash where influxes disappear.
      await Promise.all([
        influxesQuery?.refresh(),
        collectionQuery?.refresh(),
      ]);
      pendingInfluxes = [];
      mappingChanges = null;
      mappingEditorRef?.resolveAll();
      toast.success("Properties saved");
    } catch (e) {
      toast.error("Failed to save properties");
    } finally {
      savingMappings = false;
    }
  }
</script>

<SiteHeader>
  <a
    href="/collections"
    class="text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; collections
  </a>
</SiteHeader>

{#if collection}
  <div class="page-shell px-4 py-8 sm:px-6">
    <div class="mb-8">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">{collection.displayName ?? collection.name}</h1>
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
            <Popover.Content class="w-80" align="start">
              <form
                {...updateCollection
                  .preflight(
                    v.object({
                      id: v.string(),
                      displayName: v.pipe(v.string(), v.nonEmpty("Display name is required")),
                      name: v.optional(v.string()),
                    }),
                  )
                  .enhance(async ({ submit, data }) => {
                    namePopoverOpen = false;
                    await tcToast(async () => {
                      await submit().updates(
                        collectionQuery.withOverride((c) => ({
                          ...c!,
                          ...data,
                        })),
                      );
                      toast.success("Collection updated successfully");
                    });
                  })}
                class="space-y-3"
              >
                <input
                  {...updateCollection.fields.id.as("text")}
                  type="hidden"
                />
                <div class="space-y-1.5">
                  <Label for={displayNameId}>Display Name</Label>
                  <Input
                    id={displayNameId}
                    {...updateCollection.fields.displayName.as("text")}
                  />
                  {#each updateCollection.fields.displayName.issues() as issue}
                    <p class="text-sm text-destructive">
                      {issue.message}
                    </p>
                  {/each}
                </div>
                <div class="space-y-1.5">
                  <Label for={nameId}>Identifier Name <span class="text-xs text-muted-foreground">(optional override)</span></Label>
                  <Input
                    id={nameId}
                    {...updateCollection.fields.name.as("text")}
                    placeholder="Leave blank to derive from display name"
                  />
                  {#each updateCollection.fields.name.issues() as issue}
                    <p class="text-sm text-destructive">
                      {issue.message}
                    </p>
                  {/each}
                </div>
                <div class="flex justify-end gap-2">
                  <Popover.Close>
                    <Button type="button" variant="outline" size="sm">
                      Cancel
                    </Button>
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

    <!-- Properties (unified: influxes + schema + mappings) -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Properties
        </h2>
        <AddInfluxDialog
          linkedSourceCollectionIds={linkedSourceIds}
          linkedSourceCollectionRefs={linkedSourceRefs}
          onSelect={handleAddInflux}
        />
      </div>

      <p class="mb-3 text-xs text-muted-foreground">
        Define the target schema for this collection and configure how each influx maps to it.
      </p>

      <!-- Influx list -->
      <svelte:boundary>
        {#snippet pending()}
          <p class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon class="size-4 animate-spin" /> Loading...
          </p>
        {/snippet}

        <div class="mb-4 space-y-2">
          {#each await influxesQuery as influx (influx.id)}
            {@const remove = removeInflux.for(influx.id)}
            <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div class="flex items-center gap-2">
                <SourceTypeIcon
                  type={influx.sourceType}
                  class="h-4 w-4 text-muted-foreground"
                />
                <span class="text-sm">
                  {#if influx.sourceName}
                    <span class="text-muted-foreground">{influx.sourceName} /</span>
                  {/if}
                  {influx.sourceCollectionName}
                </span>
              </div>
              <form
                {...remove.enhance(async ({ submit, data }) => {
                  if (remove.pending) return;
                  await submit().updates(
                    getInfluxes({ collectionId: params.id }),
                    collectionQuery,
                  );
                })}
              >
                <input
                  {...remove.fields.id.as("text")}
                  type="hidden"
                  value={influx.id}
                />
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          type="submit"
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={remove.pending > 0}
                        >
                          <TrashIcon class="size-3.5" />
                        </Button>
                      {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Remove</Tooltip.Content>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </form>
            </div>
          {/each}

          {#each pendingInfluxes as pending (pending.tempId)}
            <div class="flex items-center justify-between rounded-md border border-dashed border-amber-400/60 bg-amber-50/50 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-900/10">
              <div class="flex items-center gap-2">
                <SourceTypeIcon
                  type={pending.sourceType}
                  class="h-4 w-4 text-muted-foreground"
                />
                <span class="text-sm">
                  {#if pending.sourceName}
                    <span class="text-muted-foreground">{pending.sourceName} /</span>
                  {/if}
                  {pending.sourceCollectionName}
                </span>
                <span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  unsaved
                </span>
              </div>
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onclick={() => removePendingInflux(pending.tempId)}
                      >
                        <TrashIcon class="size-3.5" />
                      </Button>
                    {/snippet}
                  </Tooltip.Trigger>
                  <Tooltip.Content>Remove</Tooltip.Content>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          {/each}

          {#if (influxesQuery?.current ?? []).length === 0 && pendingInfluxes.length === 0}
            <p class="text-sm text-muted-foreground">
              No influxes configured yet. Add one to start receiving content.
            </p>
          {/if}
        </div>

        {#snippet failed(error)}
          <p class="mb-4 text-sm text-muted-foreground">
            Error loading influxes: {(error as any).message}
          </p>
        {/snippet}
      </svelte:boundary>

      <!-- Mapping editor -->
      <MappingEditor
        bind:this={mappingEditorRef}
        targetSchema={collection.schema}
        refTargets={collection.refTargets}
        availableCollections={allCollections.map((c) => ({ name: c.name, displayName: c.displayName }))}
        influxes={combinedInfluxes}
        onchange={handleMappingChange}
      />

      {#if mappingChanges || pendingInfluxes.length > 0}
        <div class="mt-4 space-y-2">
          <p class="text-xs text-amber-600 dark:text-amber-400">
            {#if pendingInfluxes.length > 0}
              {pendingInfluxes.length} unsaved influx{pendingInfluxes.length === 1 ? "" : "es"} will be created.
            {/if}
            {#if mappingChanges}
              Schema changes trigger a full resync for connected consumers.
            {/if}
          </p>
          <div class="flex gap-2">
            <Button
              size="sm"
              disabled={savingMappings}
              onclick={saveMappings}
            >
              {savingMappings ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onclick={() => {
                mappingChanges = null;
                pendingInfluxes = [];
                mappingEditorRef?.reset();
              }}
            >
              Cancel
            </Button>
          </div>
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

      <svelte:boundary>
        {#snippet pending()}
          <p class="mb-4 text-sm text-muted-foreground">Loading...</p>
        {/snippet}
        <div class="mb-4 space-y-2">
          {#each await connectionsQuery as connection}
            {@const remove = removeConsumerCollection.for(connection.consumerId)}
            <div
              class="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <a
                href="/consumers/{connection.consumerId}"
                class="text-sm font-medium hover:underline"
              >
                {connection.consumerName || "Unnamed Consumer"}
              </a>
              <form
                {...remove.enhance(async ({ submit }) => {
                  if (remove.pending) return;
                  await submit().updates(
                    connectionsQuery.withOverride((connections) =>
                      connections.filter(
                        (c) => c.consumerId !== connection.consumerId,
                      ),
                    ),
                    collectionQuery,
                  );
                  toast.success("Consumer disconnected");
                })}
              >
                <input
                  {...remove.fields.consumerId.as("text")}
                  type="hidden"
                  value={connection.consumerId}
                />
                <input
                  {...remove.fields.collectionId.as("text")}
                  type="hidden"
                  value={collection.id}
                />
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          type="submit"
                          variant="destructive"
                          size="sm"
                          disabled={remove.pending > 0}
                        >
                          <UnlinkIcon class="size-4" />
                        </Button>
                      {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Disconnect</Tooltip.Content>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </form>
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">
              No consumers connected yet.
            </p>
          {/each}
        </div>
        {#snippet failed(error)}
          <p class="mb-4 text-sm text-muted-foreground">
            Error loading consumers: {(error as any).message}
          </p>
        {/snippet}
      </svelte:boundary>

      {#if availableConsumers.length > 0}
        {@const selectedConsumer = availableConsumers.find(
          (c) => c.id === selectedConsumerId,
        )}
        <form
          {...addConsumerCollection.enhance(async ({ submit }) => {
            await tcToast(async () => {
              const override = {
                collectionName: collection.name,
                consumerName: selectedConsumer!.name,
                consumerId: selectedConsumerId!,
                collectionId: collection.id,
              } as ServiceConsumerCollectionWithDetails;
              await submit().updates(
                connectionsQuery.withOverride((connections) => [
                  ...connections,
                  override,
                ]),
                collectionQuery,
              );
              selectedConsumerId = null;
              toast.success("Consumer connected");
            });
          })}
          class="flex gap-2"
        >
          <input
            {...addConsumerCollection.fields.collectionId.as("text")}
            type="hidden"
            value={collection.id}
          />
          <input
            {...addConsumerCollection.fields.consumerId.as("text")}
            type="hidden"
            value={selectedConsumerId!}
          />
          <Popover.Root bind:open={consumerComboboxOpen}>
            <Popover.Trigger
              class="inline-flex flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              role="combobox"
              aria-expanded={consumerComboboxOpen}
            >
              {#if selectedConsumerId !== null}
                {@const selected = availableConsumers.find(
                  (c) => c.id === selectedConsumerId,
                )}
                {#if selected}
                  {selected?.name ?? "Unnamed Consumer"}
                {:else}
                  Select consumer...
                {/if}
              {:else}
                Select consumer...
              {/if}
              <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Popover.Trigger>
            <Popover.Content
              class="w-(--radix-popover-trigger-width) p-0"
              align="start"
            >
              <Command.Root>
                <Command.Input placeholder="Search consumers..." />
                <Command.List>
                  <Command.Empty>No consumer found.</Command.Empty>
                  <Command.Group>
                    {#each availableConsumers as consumer}
                      <Command.Item
                        value={`${consumer.name ?? "Unnamed Consumer"} ${consumer.id}`}
                        onSelect={() => {
                          selectedConsumerId = consumer.id;
                          consumerComboboxOpen = false;
                        }}
                      >
                        {consumer.name || "Unnamed Consumer"}
                        {#if selectedConsumerId === consumer.id}
                          <Check class="ml-auto size-4" />
                        {/if}
                      </Command.Item>
                    {/each}
                  </Command.Group>
                </Command.List>
              </Command.Root>
            </Popover.Content>
          </Popover.Root>
          <Button
            type="submit"
            variant="outline"
            disabled={selectedConsumerId === null}
          >
            <LinkIcon class="size-4" />
            Connect Consumer
          </Button>
        </form>
      {:else if allConsumers.length === 0}
        <p class="text-sm text-muted-foreground">
          No consumers available. <a
            href="/consumers/new"
            class="text-primary hover:underline">Create one</a
          > first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">All consumers are connected.</p>
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
      <form
        {...deleteCollection.enhance(async ({ submit }) => {
          await submit();
          goto("/collections");
        })}
      >
        <input
          {...deleteCollection.fields.id.as("text")}
          type="hidden"
          value={collection.id}
        />
        <Button type="submit" variant="destructive" size="sm">
          <TrashIcon class="size-4" />
          Delete Collection
        </Button>
      </form>
    </section>
  </div>
{/if}
