<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import IconPicker from "$lib/components/IconPicker.svelte";
  import MappingEditor from "$lib/components/MappingEditor.svelte";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import * as Popover from "$lib/components/ui/popover";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import * as Select from "$lib/components/ui/select";
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
  import { BoxesIcon, LinkIcon, ShapesIcon, TrashIcon, UnlinkIcon } from "@lucide/svelte";
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
  const quota = $derived(await getQuotaUsage());
  const atFlowLimit = $derived(quota !== null && quota.maxFlows !== -1 && quota.flows >= quota.maxFlows);

  // Sync form fields when collection changes (always set, even for non-editable
  // collections, so the form framework's internal state stays valid)
  let prevCollection: typeof collection;
  $effect(() => {
    if (collection && collection !== prevCollection) {
      prevCollection = collection;
      updateCollection.fields.set({
        id: collection.id,
        displayName: collection.displayName,
        name: collection.name,
      });
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
  let iconPopoverOpen = $state(false);
  let pendingIcon = $state<string | null>(null);
  $effect(() => {
    if (iconPopoverOpen) {
      // Reset pendingIcon to current collection icon when opening popover
      pendingIcon = collection?.icon ? JSON.stringify(collection.icon) : null;
    }
  });
  let selectedSourceId = $state<string>("");
  let selectedTargetId = $state<string>("");

  function groupByConnection<T extends { connectionId: string | null; connectionName: string | null; connectionType: number | null }>(
    items: T[],
  ) {
    const order: (string | null)[] = [];
    const groups = new Map<string | null, { connectionId: string | null; connectionType: number | null; name: string; items: T[] }>();
    for (const c of items) {
      const key = c.connectionId ?? null;
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, { connectionId: key, connectionType: c.connectionType ?? null, name: c.connectionName ?? "standalone", items: [] });
      }
      groups.get(key)!.items.push(c);
    }
    return [null, ...order.filter((k) => k !== null)]
      .filter((k) => groups.has(k))
      .map((k) => groups.get(k)!);
  }

  function groupFlowsByConnection(
    flowList: ServiceFlowWithDetails[],
    direction: 'source' | 'target',
  ) {
    const order: (string | null)[] = [];
    const groups = new Map<string | null, { connectionId: string | null; connectionType: number | null; name: string; items: ServiceFlowWithDetails[] }>();
    for (const flow of flowList) {
      const colId = direction === 'source' ? flow.sourceId : flow.targetId;
      const col = allCollections.find((c) => c.id === colId);
      const key = col?.connectionId ?? null;
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, { connectionId: key, connectionType: col?.connectionType ?? null, name: col?.connectionName ?? "standalone", items: [] });
      }
      groups.get(key)!.items.push(flow);
    }
    return [null, ...order.filter((k) => k !== null)]
      .filter((k) => groups.has(k))
      .map((k) => groups.get(k)!);
  }

  const groupedSourceCollections = $derived(groupByConnection(availableSourceCollections));
  const groupedTargetCollections = $derived(groupByConnection(availableTargetCollections));

  const groupedSourceFlows = $derived(groupFlowsByConnection(sourceFlows, 'source'));
  const groupedTargetFlows = $derived(groupFlowsByConnection(targetFlows, 'target'));

  // Schema & Mappings state
  let mappingChanges = $state<{
    targetSchema: CollectionSchema;
    inflowMappings: Map<string, MappingRule[]>;
    inflowFilters: Map<string, Filter[]>;
    refTargets: RefTargets;
  } | null>(null);

  const requiresResync = $derived(
    mappingChanges && collection
      ? Object.keys(mappingChanges.targetSchema).some((k) => !(k in collection.schema))
      : false
  );
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
    return sourceFlows.map((flow) => {
      const sourceCol = allCollections.find((c) => c.id === flow.sourceId);
      return {
        id: flow.id,
        name: flow.sourceCollectionDisplayName ?? flow.sourceCollectionName,
        icon: sourceCol?.icon ?? null,
        connectionId: sourceCol?.connectionId ?? null,
        connectionName: sourceCol?.connectionName ?? null,
        connectionType: sourceCol?.connectionType ?? null,
        sourceSchema: flow.schema,
        mappings: flow.mappings ?? [],
        filters: flow.filters ?? [],
      };
    });
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
        selectedSourceId = "";
        await Promise.all([
          getFlowsByCollection({ collectionId: id }).refresh(),
          getQuotaUsage().refresh(),
        ]);
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
        selectedTargetId = "";
        await Promise.all([
          getFlowsByCollection({ collectionId: id }).refresh(),
          getQuotaUsage().refresh(),
        ]);
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
      await Promise.all([
        getFlowsByCollection({ collectionId: id }).refresh(),
        getQuotaUsage().refresh(),
      ]);
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
  {@const canEditMeta = !meta || meta.editable}
  {@const showInflows = !meta || meta.target}
  {@const showOutflows = !meta || meta.source}
  {@const collectionIcon = collection.icon ?? null}
  <div class="page-shell px-4 py-8 sm:px-6">
    <div class="mb-8">
      <div class="flex items-center gap-2">
        <!-- Icon display (+ edit popover if editable) -->
        {#if canEditMeta}
          <Popover.Root bind:open={iconPopoverOpen}>
            <Popover.Trigger
              class={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-10 w-10 rounded-md text-2xl hover:bg-accent",
              )}
            >
              {#if collectionIcon?.type === "emoji"}
                <span>{collectionIcon.value}</span>
              {:else if collectionIcon?.type === "image"}
                <img src={collectionIcon.url} alt="" class="h-7 w-7 object-contain" />
              {:else}
                <BoxesIcon class="h-7 w-7 text-muted-foreground" />
              {/if}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content class="w-72" align="start">
                <form
                  {...updateCollection
                    .preflight(v.object({ id: v.string(), icon: v.optional(v.string()) }))
                    .enhance(async ({ submit }) => {
                      iconPopoverOpen = false;
                      await tcToast(async () => {
                        await submit().updates(
                          getCollection({ id }).withOverride((c) => ({
                            ...c!,
                            icon: pendingIcon ? JSON.parse(pendingIcon) : null,
                          })),
                        );
                        toast.success("Icon updated");
                      });
                    })}
                  class="space-y-3"
                >
                  <input {...updateCollection.fields.id.as("text")} type="hidden" />
                  <input
                    type="hidden"
                    name="icon"
                    value={pendingIcon === null ? "null" : (pendingIcon ?? "")}
                  />
                  <p class="text-xs font-medium text-muted-foreground">Collection icon</p>
                  <IconPicker
                    value={collectionIcon ? JSON.stringify(collectionIcon) : null}
                    onchange={(v) => { pendingIcon = v; }}
                  />
                  <div class="flex justify-end gap-2">
                    <Popover.Close>
                      <Button type="button" variant="outline" size="sm">Cancel</Button>
                    </Popover.Close>
                    <Button type="submit" size="sm" disabled={!!updateCollection.pending}>
                      {updateCollection.pending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        {/if}
        {#if !canEditMeta}
          <div class="flex h-10 w-10 items-center justify-center text-2xl">
            {#if collectionIcon?.type === "emoji"}
              <span>{collectionIcon.value}</span>
            {:else if collectionIcon?.type === "image"}
              <img src={collectionIcon.url} alt="" class="h-7 w-7 object-contain" />
            {:else}
              <BoxesIcon class="h-7 w-7 text-muted-foreground" />
            {/if}
          </div>
        {/if}

        <h1 class="text-2xl font-semibold tracking-tight">{collection.displayName ?? collection.name}</h1>
        {#if canEditMeta}
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
        {/if}
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

      {#if atFlowLimit}
        <p class="mb-3 text-sm text-muted-foreground">
          Flow limit reached ({quota?.flows}/{quota?.maxFlows}).
          <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more flows.
        </p>
      {/if}

      <!-- Source flow list -->
      <div class="mb-4 space-y-2">
        {#each groupedSourceFlows as group}
          <div class="mb-1 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground first:mt-0">
            {#if group.connectionId !== null && group.connectionType != null}
              <ConnectionIcon type={group.connectionType} class="h-3 w-3" />
            {:else}
              <ShapesIcon class="h-3 w-3" />
            {/if}
            <span>{group.name}</span>
          </div>
          {#each group.items as flow (flow.id)}
            {@const flowSourceCol = allCollections.find((c) => c.id === flow.sourceId)}
            <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div class="flex items-center gap-2">
                {#if flowSourceCol?.icon?.type === "emoji"}
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{flowSourceCol.icon.value}</span>
                {:else if flowSourceCol?.icon?.type === "image"}
                  <img src={flowSourceCol.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                {:else}
                  <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
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
        {/each}

        {#if sourceFlows.length === 0}
          <p class="text-sm text-muted-foreground">
            No inflows configured yet. Add one to start receiving content.
          </p>
        {/if}
      </div>

      <!-- Add source flow -->
      {#if availableSourceCollections.length > 0}
        {@const selectedSource = availableSourceCollections.find((c) => c.id === selectedSourceId)}
        <div class="flex items-center gap-2">
          <Select.Root bind:value={selectedSourceId} type="single" disabled={atFlowLimit}>
            <Select.Trigger class="flex-1">
              {#if selectedSource}
                {#if selectedSource.icon?.type === "emoji"}
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{selectedSource.icon.value}</span>
                {:else if selectedSource.icon?.type === "image"}
                  <img src={selectedSource.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                {:else}
                  <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                {/if}
                <span class="truncate">{selectedSource.displayName ?? selectedSource.name}</span>
              {:else}
                <span class="text-muted-foreground">Select inflow source...</span>
              {/if}
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper">
                {#each groupedSourceCollections as group}
                  {#if group.connectionId !== null}
                    <Select.Group>
                      <Select.GroupLabel>
                        <span class="flex items-center gap-1.5">
                          {#if group.connectionType != null}
                            <ConnectionIcon type={group.connectionType} class="h-3 w-3" />
                          {/if}
                          {group.name}
                        </span>
                      </Select.GroupLabel>
                      {#each group.items as col}
                        <Select.Item value={col.id} label={col.displayName ?? col.name}>
                          {#snippet icon()}
                            {#if col.icon?.type === "emoji"}
                              <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{col.icon.value}</span>
                            {:else if col.icon?.type === "image"}
                              <img src={col.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                            {:else}
                              <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                            {/if}
                          {/snippet}
                        </Select.Item>
                      {/each}
                    </Select.Group>
                  {:else}
                    {#each group.items as col}
                      <Select.Item value={col.id} label={col.displayName ?? col.name}>
                        {#snippet icon()}
                          {#if col.icon?.type === "emoji"}
                            <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{col.icon.value}</span>
                          {:else if col.icon?.type === "image"}
                            <img src={col.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                          {/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  {/if}
                {/each}
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <Button
            variant="outline"
            disabled={!selectedSourceId || atFlowLimit}
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
          {#if requiresResync}
            <p class="text-xs text-amber-600 dark:text-amber-400">
              New properties detected — saving will trigger a full resync for connected consumers.
            </p>
          {:else}
            <p class="text-xs text-muted-foreground">
              Saving will update item properties for connected consumers without a full resync.
            </p>
          {/if}
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

      {#if atFlowLimit}
        <p class="mb-3 text-sm text-muted-foreground">
          Flow limit reached ({quota?.flows}/{quota?.maxFlows}).
          <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more flows.
        </p>
      {/if}

      <div class="mb-4 space-y-2">
        {#each groupedTargetFlows as group}
          <div class="mb-1 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground first:mt-0">
            {#if group.connectionId !== null && group.connectionType != null}
              <ConnectionIcon type={group.connectionType} class="h-3 w-3" />
            {:else}
              <ShapesIcon class="h-3 w-3" />
            {/if}
            <span>{group.name}</span>
          </div>
          {#each group.items as flow (flow.id)}
            {@const flowTargetCol = allCollections.find((c) => c.id === flow.targetId)}
            <div
              class="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <a
                href="/collections/{flow.targetId}"
                class="flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                {#if flowTargetCol?.icon?.type === "emoji"}
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{flowTargetCol.icon.value}</span>
                {:else if flowTargetCol?.icon?.type === "image"}
                  <img src={flowTargetCol.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                {:else}
                  <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                {/if}
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
          {/each}
        {/each}
        {#if targetFlows.length === 0}
          <p class="text-sm text-muted-foreground">
            No outflows configured yet.
          </p>
        {/if}
      </div>

      {#if availableTargetCollections.length > 0}
        {@const selectedTarget = availableTargetCollections.find((c) => c.id === selectedTargetId)}
        <div class="flex items-center gap-2">
          <Select.Root bind:value={selectedTargetId} type="single">
            <Select.Trigger class="flex-1">
              {#if selectedTarget}
                {#if selectedTarget.icon?.type === "emoji"}
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{selectedTarget.icon.value}</span>
                {:else if selectedTarget.icon?.type === "image"}
                  <img src={selectedTarget.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                {:else}
                  <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                {/if}
                <span class="truncate">{selectedTarget.displayName ?? selectedTarget.name}</span>
              {:else}
                <span class="text-muted-foreground">Select outflow target...</span>
              {/if}
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper">
                {#each groupedTargetCollections as group}
                  {#if group.connectionId !== null}
                    <Select.Group>
                      <Select.GroupLabel>
                        <span class="flex items-center gap-1.5">
                          {#if group.connectionType != null}
                            <ConnectionIcon type={group.connectionType} class="h-3 w-3" />
                          {/if}
                          {group.name}
                        </span>
                      </Select.GroupLabel>
                      {#each group.items as col}
                        <Select.Item value={col.id} label={col.displayName ?? col.name}>
                          {#snippet icon()}
                            {#if col.icon?.type === "emoji"}
                              <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{col.icon.value}</span>
                            {:else if col.icon?.type === "image"}
                              <img src={col.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                            {:else}
                              <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                            {/if}
                          {/snippet}
                        </Select.Item>
                      {/each}
                    </Select.Group>
                  {:else}
                    {#each group.items as col}
                      <Select.Item value={col.id} label={col.displayName ?? col.name}>
                        {#snippet icon()}
                          {#if col.icon?.type === "emoji"}
                            <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{col.icon.value}</span>
                          {:else if col.icon?.type === "image"}
                            <img src={col.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                          {/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  {/if}
                {/each}
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <Button
            variant="outline"
            disabled={!selectedTargetId || atFlowLimit}
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
