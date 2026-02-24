<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import AddInfluxDialog from "$lib/components/AddInfluxDialog.svelte";
  import FilterEditor from "$lib/components/FilterEditor.svelte";
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
    getSourceCollectionSchemaQuery,
    updateCollection,
  } from "$lib/remote/collections.remote";
  import {
    addConnection,
    getConnectionsByCollection,
    removeConnection,
  } from "$lib/remote/connections.remote";
  import { getConsumers } from "$lib/remote/consumers.remote";
  import {
    getInfluxes,
    removeInflux,
    updateInfluxForm,
  } from "$lib/remote/influxes.remote";
  import { cn } from "$lib/utils";
  import { tcToast } from "$lib/utils/toast";
  import type {
    CollectionSchema,
    Filter as FilterType,
    ServiceConnectionWithDetails,
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
  const collection = $derived(await getCollection({ id }));

  // Sync form fields when collection changes
  $effect(() => {
    updateCollection.fields.set(collection);
  });

  // Query objects - auto-refresh after form submissions
  const influxesQuery = $derived(getInfluxes({ collectionId: params.id }));
  const connectionsQuery = $derived(
    getConnectionsByCollection({ collectionId: params.id }),
  );
  const allConsumers = $derived(await getConsumers());

  // Derived from query.current
  const linkedSourceIds = $derived(
    new Set((influxesQuery?.current ?? []).map((m) => m.sourceCollectionId)),
  );
  const linkedSourceRefs = $derived(
    new Set(
      (influxesQuery?.current ?? [])
        .map((m) => m.sourceCollectionRef)
        .filter((r): r is string => r !== null),
    ),
  );
  const connectedConsumerIds = $derived(
    new Set((connectionsQuery?.current ?? []).map((c) => c.consumerId)),
  );
  const availableConsumers = $derived(
    allConsumers.filter((c) => !connectedConsumerIds.has(c.id)),
  );

  // Refresh influxes after adding via dialog (command, not form - doesn't auto-refresh)
  function refreshInfluxes() {
    influxesQuery?.refresh();
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
</script>

<SiteHeader>
  <a
    href="/collections"
    class="text-sm text-muted-foreground hover:text-foreground"
  >
    ← Collections
  </a>
</SiteHeader>

{#if collection}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
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
                        getCollection({ id }).withOverride((c) => ({
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

      <svelte:boundary>
        {#snippet pending()}
          <p class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon class="size-4 animate-spin" /> Loading...
          </p>
        {/snippet}

        <div class="mb-4 space-y-2">
          {#each await influxesQuery as influx (influx.id)}
            {@const remove = removeInflux.for(influx.id)}
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
                <form
                  {...remove.enhance(async ({ submit, data }) => {
                    // For some reason, the form is submitting multiple times. when we remove influxes subsequently.
                    if (remove.pending) return;
                    await submit().updates(
                      getInfluxes({
                        collectionId: params.id,
                      }),
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
                            variant="destructive"
                            size="sm"
                            disabled={remove.pending > 0}
                          >
                            <TrashIcon class="size-4" />
                          </Button>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>Remove</Tooltip.Content>
                    </Tooltip.Root>
                  </Tooltip.Provider>
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
                      <form
                        {...updateInfluxForm.enhance(async ({ submit }) => {
                          await submit();
                          toast.success("Filters updated");
                          filterEdits = new Map();
                        })}
                      >
                        <input
                          {...updateInfluxForm.fields.collectionId.as("text")}
                          type="hidden"
                          value={collection.id}
                        />
                        <input
                          {...updateInfluxForm.fields.sourceCollectionId.as(
                            "text",
                          )}
                          type="hidden"
                          value={influx.sourceCollectionId}
                        />
                        <input
                          {...updateInfluxForm.fields.filters.as("text")}
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
          {:else}
            <p class="mb-4 text-sm text-muted-foreground">
              No influxes configured yet. Add one to start receiving content.
            </p>
          {/each}
        </div>
        {#snippet failed(error)}
          <p class="mb-4 text-sm text-muted-foreground">
            Error loading influxes: {(error as any).message}
          </p>
        {/snippet}
      </svelte:boundary>
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
            {@const remove = removeConnection.for(connection.consumerId)}
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
          {...addConnection.enhance(async ({ submit }) => {
            await tcToast(async () => {
              const override = {
                collectionName: collection.name,
                consumerName: selectedConsumer!.name,
                consumerId: selectedConsumerId!,
                collectionId: collection.id,
              } as ServiceConnectionWithDetails;
              await submit().updates(
                connectionsQuery.withOverride((connections) => [
                  ...connections,
                  override,
                ]),
              );
              toast.success("Consumer connected");
            });
          })}
          class="flex gap-2"
        >
          <input
            {...addConnection.fields.collectionId.as("text")}
            type="hidden"
            value={collection.id}
          />
          <input
            {...addConnection.fields.consumerId.as("text")}
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
