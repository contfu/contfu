<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import MappingEditor from "$lib/components/MappingEditor.svelte";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
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
    updateCollection,
    updateCollectionSchema,
  } from "$lib/remote/collections.remote";
  import {
    addFlow,
    getFlowsByCollection,
    removeFlow,
    updateFlowFilters,
    updateFlowMappings,
  } from "$lib/remote/flows.remote";
  import { cn } from "$lib/utils";
  import { tcToast } from "$lib/utils/toast";
  import type {
    CollectionSchema,
    Filter,
    MappingRule,
    RefTargets,
    ServiceFlowWithDetails,
  } from "@contfu/svc-core";
  import { ConnectionTypeMeta } from "@contfu/svc-core";
  import {
    Check,
    ChevronsUpDown,
    LinkIcon,
    TrashIcon,
    UnlinkIcon,
  } from "@lucide/svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { toast } from "svelte-sonner";
  import * as v from "valibot";

  const nameId = useId();
  const displayNameId = useId();
  let { params } = $props();

  let id = $derived(params.id);

  const collection = $derived(await (id !== "new" ? getCollection({ id }) : null));
  const allCollections = $derived(await getCollections());

  // Sync form fields when collection changes
  let prevCollection: typeof collection;
  $effect(() => {
    if (collection && collection !== prevCollection) {
      prevCollection = collection;
      updateCollection.fields.set(collection);
    }
  });

  // Separate flows by direction
  const flows = $derived(await (id !== "new" ? getFlowsByCollection({ collectionId: id }) : null));
  const sourceFlows = $derived((flows ?? []).filter((f) => f.targetId === id));
  const targetFlows = $derived((flows ?? []).filter((f) => f.sourceId === id));

  // For adding source flows: collections that can be a source (not already linked)
  const linkedSourceIds = $derived(
    new Set(sourceFlows.map((f) => f.sourceId)),
  );
  const availableSourceCollections = $derived(
    allCollections.filter(
      (c) => c.id !== id && !linkedSourceIds.has(c.id),
    ),
  );

  // For adding target flows: collections that can be a target (not already linked)
  const linkedTargetIds = $derived(
    new Set(targetFlows.map((f) => f.targetId)),
  );
  const availableTargetCollections = $derived(
    allCollections.filter(
      (c) =>
        c.id !== id &&
        !linkedTargetIds.has(c.id) &&
        (c.connectionType == null || ConnectionTypeMeta[c.connectionType]?.target),
    ),
  );

  let namePopoverOpen = $state(false);
  let sourceComboboxOpen = $state(false);
  let targetComboboxOpen = $state(false);
  let selectedSourceId = $state<string | null>(null);
  let selectedTargetId = $state<string | null>(null);

  // Schema & Mappings state
  let mappingChanges = $state<{
    targetSchema: CollectionSchema;
    inflowMappings: Map<string, MappingRule[]>;
    inflowFilters: Map<string, Filter[]>;
    refTargets: RefTargets;
  } | null>(null);
  let savingMappings = $state(false);
  let mappingEditorRef = $state<MappingEditor | undefined>();

  function handleMappingChange(changes: {
    targetSchema: CollectionSchema;
    inflowMappings: Map<string, MappingRule[]>;
    inflowFilters: Map<string, Filter[]>;
    refTargets: RefTargets;
  }) {
    mappingChanges = changes;
  }

  // Combine source flows for MappingEditor (source flows feed INTO this collection)
  const combinedInflows = $derived.by(() => {
    return sourceFlows.map((flow) => ({
      id: flow.id,
      name: flow.sourceCollectionDisplayName ?? flow.sourceCollectionName,
      sourceSchema: flow.schema,
      mappings: flow.mappings ?? [],
      filters: flow.filters ?? [],
    }));
  });

  async function saveMappings() {
    if (!mappingChanges || !collection) return;
    if (mappingEditorRef?.hasValidationErrors()) {
      toast.error("Fix validation errors before saving");
      return;
    }
    savingMappings = true;
    try {
      // 1. Save collection schema
      await updateCollectionSchema({
        id: collection.id,
        schema: JSON.stringify(mappingChanges.targetSchema),
        refTargets: JSON.stringify(mappingChanges.refTargets),
      });

      // 2. Save each flow's mappings
      for (const [flowId, rules] of mappingChanges.inflowMappings) {
        await updateFlowMappings({
          id: flowId,
          mappings: JSON.stringify(rules),
        });
      }

      // 3. Save each flow's filters
      for (const [flowId, filters] of mappingChanges.inflowFilters) {
        await updateFlowFilters({
          id: flowId,
          filters: JSON.stringify(filters),
        });
      }

      await Promise.all([
        getFlowsByCollection({ collectionId: id }).refresh(),
        getCollection({ id }).refresh(),
      ]);
      mappingChanges = null;
      mappingEditorRef?.resolveAll();
      toast.success("Properties saved");
    } catch (e) {
      toast.error("Failed to save properties");
    } finally {
      savingMappings = false;
    }
  }

  async function handleAddSourceFlow() {
    if (!selectedSourceId) return;
    try {
      const result = await addFlow({
        sourceId: selectedSourceId,
        targetId: id,
      });
      if (result.success) {
        toast.success("Inflow added");
        selectedSourceId = null;
        await getFlowsByCollection({ collectionId: id }).refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to add inflow");
    }
  }

  async function handleAddTargetFlow() {
    if (!selectedTargetId) return;
    try {
      const result = await addFlow({
        sourceId: id,
        targetId: selectedTargetId,
      });
      if (result.success) {
        toast.success("Outflow added");
        selectedTargetId = null;
        await getFlowsByCollection({ collectionId: id }).refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to add outflow");
    }
  }

  async function handleRemoveFlow(flowId: string) {
    try {
      await removeFlow({ id: flowId });
      toast.success("Flow removed");
      await getFlowsByCollection({ collectionId: id }).refresh();
    } catch {
      toast.error("Failed to remove flow");
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
  {@const meta = collection.connectionType != null ? ConnectionTypeMeta[collection.connectionType] : null}
  {@const canEditSchema = !meta || meta.editable}
  {@const showInflows = !meta || meta.target}
  {@const showOutflows = !meta || meta.source}
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
        {collection.flowSourceCount} inflow{collection.flowSourceCount === 1
          ? ""
          : "s"} ·
        {collection.flowTargetCount} outflow{collection.flowTargetCount === 1
          ? ""
          : "s"}
      </p>
      {#if collection.connectionName}
        <a
          href="/connections/{collection.connectionId}"
          class="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <ConnectionIcon type={collection.connectionType} class="h-3 w-3" />
          {collection.connectionName}
        </a>
      {/if}
    </div>

    <!-- Inflows -->
    {#if showInflows}
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Inflows
      </h2>

      <p class="mb-3 text-xs text-muted-foreground">
        Collections that feed content into this collection.
      </p>

      <!-- Source flow list -->
      <div class="mb-4 space-y-2">
        {#each sourceFlows as flow (flow.id)}
          <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div class="flex items-center gap-2">
              {#if flow.sourceConnectionType != null}
                <ConnectionIcon
                  type={flow.sourceConnectionType}
                  class="h-4 w-4 text-muted-foreground"
                />
              {/if}
              <a href="/collections/{flow.sourceId}" class="text-sm hover:text-primary transition-colors duration-150">
                {flow.sourceCollectionDisplayName ?? flow.sourceCollectionName}
              </a>
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
                      onclick={() => handleRemoveFlow(flow.id)}
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

        {#if sourceFlows.length === 0}
          <p class="text-sm text-muted-foreground">
            No inflows configured yet. Add one to start receiving content.
          </p>
        {/if}
      </div>

      <!-- Add source flow -->
      {#if availableSourceCollections.length > 0}
        <div class="flex gap-2">
          <Popover.Root bind:open={sourceComboboxOpen}>
            <Popover.Trigger
              class="inline-flex flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="combobox"
              aria-expanded={sourceComboboxOpen}
            >
              {#if selectedSourceId}
                {@const selected = availableSourceCollections.find((c) => c.id === selectedSourceId)}
                {selected?.displayName ?? selected?.name ?? "Select collection..."}
              {:else}
                Select inflow source...
              {/if}
              <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Popover.Trigger>
            <Popover.Content class="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command.Root>
                <Command.Input placeholder="Search collections..." />
                <Command.List>
                  <Command.Empty>No collection found.</Command.Empty>
                  <Command.Group>
                    {#each availableSourceCollections as col}
                      <Command.Item
                        value={`${col.displayName ?? col.name} ${col.id}`}
                        onSelect={() => {
                          selectedSourceId = col.id;
                          sourceComboboxOpen = false;
                        }}
                      >
                        {col.displayName ?? col.name}
                        {#if selectedSourceId === col.id}
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
            variant="outline"
            disabled={selectedSourceId === null}
            onclick={handleAddSourceFlow}
          >
            <LinkIcon class="size-4" />
            Add Inflow
          </Button>
        </div>
      {/if}
    </section>
    {/if}

    <!-- Properties -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Properties
      </h2>

      {#if !canEditSchema}
        <p class="mb-3 text-xs text-muted-foreground">
          Schema is managed by the connected source.
        </p>
      {/if}

      <MappingEditor
        bind:this={mappingEditorRef}
        readonly={!canEditSchema}
        targetSchema={collection.schema}
        refTargets={collection.refTargets}
        availableCollections={allCollections.map((c) => ({ name: c.name, displayName: c.displayName }))}
        inflows={combinedInflows}
        onchange={handleMappingChange}
      />

      {#if mappingChanges && canEditSchema}
        <div class="mt-4 space-y-2">
          <p class="text-xs text-amber-600 dark:text-amber-400">
            Schema changes trigger a full resync for connected consumers.
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
                mappingEditorRef?.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      {/if}
    </section>

    <!-- Outflows -->
    {#if showOutflows}
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Outflows
      </h2>

      <p class="mb-3 text-xs text-muted-foreground">
        Collections that receive content from this collection.
      </p>

      <div class="mb-4 space-y-2">
        {#each targetFlows as flow (flow.id)}
          <div
            class="flex items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <a
              href="/collections/{flow.targetId}"
              class="text-sm font-medium hover:underline"
            >
              {flow.targetCollectionDisplayName ?? flow.targetCollectionName}
            </a>
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="destructive"
                      size="sm"
                      onclick={() => handleRemoveFlow(flow.id)}
                    >
                      <UnlinkIcon class="size-4" />
                    </Button>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>Disconnect</Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">
            No outflows configured yet.
          </p>
        {/each}
      </div>

      {#if availableTargetCollections.length > 0}
        <div class="flex gap-2">
          <Popover.Root bind:open={targetComboboxOpen}>
            <Popover.Trigger
              class="inline-flex flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="combobox"
              aria-expanded={targetComboboxOpen}
            >
              {#if selectedTargetId}
                {@const selected = availableTargetCollections.find((c) => c.id === selectedTargetId)}
                {selected?.displayName ?? selected?.name ?? "Select collection..."}
              {:else}
                Select outflow target...
              {/if}
              <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Popover.Trigger>
            <Popover.Content class="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command.Root>
                <Command.Input placeholder="Search collections..." />
                <Command.List>
                  <Command.Empty>No collection found.</Command.Empty>
                  <Command.Group>
                    {#each availableTargetCollections as col}
                      <Command.Item
                        value={`${col.displayName ?? col.name} ${col.id}`}
                        onSelect={() => {
                          selectedTargetId = col.id;
                          targetComboboxOpen = false;
                        }}
                      >
                        {col.displayName ?? col.name}
                        {#if selectedTargetId === col.id}
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
            variant="outline"
            disabled={selectedTargetId === null}
            onclick={handleAddTargetFlow}
          >
            <LinkIcon class="size-4" />
            Add Outflow
          </Button>
        </div>
      {:else if allCollections.length <= 1}
        <p class="text-sm text-muted-foreground">
          No other collections available. <a
            href="/collections/new"
            class="text-primary hover:underline">Create one</a
          > first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">All collections are connected.</p>
      {/if}
    </section>
    {/if}

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-destructive"
      >
        Danger Zone
      </h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Deleting this collection will remove all its flows.
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
