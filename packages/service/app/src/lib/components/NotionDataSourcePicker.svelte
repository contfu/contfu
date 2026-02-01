<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import {
    listNotionDataSources,
    type NotionDataSource,
  } from "$lib/remote/sources.remote";
  import { cn } from "$lib/utils";
  import {
    Check,
    ChevronsUpDown,
    Database,
    LoaderCircle,
    RefreshCw,
  } from "@lucide/svelte";

  interface Props {
    sourceId: number;
    value?: string;
    name?: string;
  }

  let { sourceId, value = $bindable(""), name = "ref" }: Props = $props();

  let open = $state(false);

  const dataPromise = listNotionDataSources({ sourceId });

  function isUsed(usedIds: string[], ds: NotionDataSource): boolean {
    return usedIds.includes(ds.id);
  }

  function handleSelect(usedIds: string[], ds: NotionDataSource) {
    if (!isUsed(usedIds, ds)) {
      value = ds.id;
      open = false;
    }
  }

  function getSelectedDataSource(dataSources: NotionDataSource[]) {
    console.log("getSelectedDataSource", value, dataSources);
    return dataSources.find((ds) => ds.id === value);
  }
</script>

{#await dataPromise}
  <!-- Loading state -->
  <button
    type="button"
    disabled
    class="inline-flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm font-medium opacity-50"
  >
    <span class="flex items-center gap-2 text-muted-foreground">
      <LoaderCircle class="size-4 animate-spin" />
      Loading data sources...
    </span>
  </button>
  <input type="hidden" {name} value="" />
{:then result}
  {@const selectedDataSource = getSelectedDataSource(result.dataSources)}
  <Popover.Root bind:open>
    <Popover.Trigger
      class="inline-flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      role="combobox"
      aria-expanded={open}
    >
      {#if selectedDataSource}
        <span class="flex items-center gap-2 truncate">
          {#if selectedDataSource.icon?.type === "emoji"}
            <span>{selectedDataSource.icon.value}</span>
          {:else}
            <Database class="size-4 shrink-0 opacity-50" />
          {/if}
          {selectedDataSource.title}
        </span>
      {:else}
        <span class="text-muted-foreground">Select data source...</span>
      {/if}
      <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
    </Popover.Trigger>
    <Popover.Content class="w-[400px] p-0" align="start">
      <Command.Root>
        <Command.Input placeholder="Search by name or paste ID..." />
        <Command.List>
          {#if result.dataSources.length === 0}
            <Command.Empty>
              <div class="py-6 text-center text-sm text-muted-foreground">
                No data sources found. Make sure your integration has access.
              </div>
            </Command.Empty>
          {:else}
            <Command.Group>
              {#each result.dataSources as ds}
                <Command.Item
                  value={`${ds.title} ${ds.id}`}
                  disabled={isUsed(result.usedIds, ds)}
                  onSelect={() => handleSelect(result.usedIds, ds)}
                  class={cn(isUsed(result.usedIds, ds) && "opacity-50")}
                >
                  {#if ds.icon?.type === "emoji"}
                    <span class="mr-2">{ds.icon.value}</span>
                  {:else}
                    <Database class="mr-2 size-4" />
                  {/if}
                  <span class="flex-1 truncate">{ds.title}</span>
                  <span class="ml-2 text-xs text-muted-foreground">
                    {ds.id.slice(0, 8)}...
                  </span>
                  {#if isUsed(result.usedIds, ds)}
                    <span class="ml-2 text-xs text-muted-foreground">
                      (already added)
                    </span>
                  {:else if value === ds.id}
                    <Check class="ml-2 size-4" />
                  {/if}
                </Command.Item>
              {/each}
            </Command.Group>
          {/if}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
  <input type="hidden" {name} {value} />
{:catch error}
  <!-- Promise rejected -->
  <div class="flex flex-col gap-2">
    <button
      type="button"
      disabled
      class="inline-flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-destructive bg-background px-3 py-2 text-sm font-medium"
    >
      <span class="text-destructive">Failed to load data sources</span>
    </button>
    <div class="flex items-center gap-2">
      <span class="text-sm text-destructive">{error.message}</span>
      <Button variant="outline" size="sm" onclick={() => dataPromise.refresh()}>
        <RefreshCw class="mr-2 size-4" />
        Retry
      </Button>
    </div>
  </div>
  <input type="hidden" {name} value="" />
{/await}
