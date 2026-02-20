<script lang="ts">
  import { buildItemQuerySearchParams } from "$lib/query/item-query";
  import { createSvelteTable, FlexRender, renderSnippet } from "$lib/components/ui/data-table";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import * as Table from "$lib/components/ui/table";
  import {
    createColumnHelper,
    getCoreRowModel,
    type Row,
  } from "@tanstack/table-core";
  import type { CollectionSummary, ItemData, QueryItemsInput, QueryItemsResult } from "contfu";

  type EditablePropFilter = {
    key: string;
    op: "eq" | "contains";
    value: string;
  };

  type Props = {
    query: QueryItemsInput;
    result: QueryItemsResult;
    collections: CollectionSummary[];
    basePath: string;
    lockedCollection?: string;
  };

  let { query, result, collections, basePath, lockedCollection }: Props = $props();

  let propFilters = $state<EditablePropFilter[]>([]);
  let selectedCollection = $state("");
  let selectedSortField = $state("changedAt");
  let selectedSortDirection = $state("desc");
  let selectedPageSize = $state("20");

  $effect(() => {
    propFilters =
      query.propFilters && query.propFilters.length > 0
        ? query.propFilters.map((filter) => ({
            key: filter.key,
            op: filter.op,
            value: String(filter.value),
          }))
        : [{ key: "", op: "eq", value: "" }];
    selectedCollection = query.collection ?? "";
    selectedSortField = query.sortField ?? "changedAt";
    selectedSortDirection = query.sortDirection ?? "desc";
    selectedPageSize = String(query.pageSize ?? 20);
  });

  function addFilterRow() {
    propFilters.push({ key: "", op: "eq", value: "" });
  }

  function removeFilterRow(index: number) {
    propFilters.splice(index, 1);
    if (propFilters.length === 0) {
      propFilters.push({ key: "", op: "eq", value: "" });
    }
  }

  function createPageHref(page: number): string {
    const params = buildItemQuerySearchParams(
      {
        ...query,
        page,
      },
      { lockedCollection },
    );

    const raw = params.toString();
    return raw ? `${basePath}?${raw}` : basePath;
  }

  const previewJson = $derived(JSON.stringify(query, null, 2));

  const columnHelper = createColumnHelper<ItemData>();
  const columns = [
    columnHelper.display({
      id: "ref",
      header: "ref",
      cell: ({ row }) => renderSnippet(refCell, { row }),
    }),
    columnHelper.accessor("collection", { header: "collection" }),
    columnHelper.accessor("changedAt", { header: "changedAt" }),
    columnHelper.accessor("id", {
      header: "id",
      cell: ({ row }) => renderSnippet(idCell, { row }),
    }),
  ];

  const table = createSvelteTable({
    get data() {
      return result.items;
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
</script>

{#snippet refCell({ row }: { row: Row<ItemData> })}
  <Button class="h-auto p-0" variant="link" href={`/items/${row.original.id}`}>{row.original.ref}</Button>
{/snippet}

{#snippet idCell({ row }: { row: Row<ItemData> })}
  <span class="font-mono text-xs">{row.original.id}</span>
{/snippet}

<div class="space-y-6">
  <form method="GET" action={basePath} class="rounded-lg border bg-card p-4">
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {#if !lockedCollection}
        <div class="text-sm">
          <Label class="mb-1 block text-muted-foreground" for="collection">Collection</Label>
          <Select.Root type="single" bind:value={selectedCollection}>
            <Select.Trigger id="collection" class="w-full">
              {selectedCollection || "All collections"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="">All collections</Select.Item>
              {#each collections as collection}
                <Select.Item value={collection.name}>{collection.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <input type="hidden" name="collection" value={selectedCollection} />
        </div>
      {/if}

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="search">Search ref</Label>
        <Input id="search" name="search" type="text" value={query.search ?? ""} placeholder="article/..." />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="changedAtFrom">Changed from</Label>
        <Input id="changedAtFrom" name="changedAtFrom" type="number" value={query.changedAtFrom ?? ""} />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="changedAtTo">Changed to</Label>
        <Input id="changedAtTo" name="changedAtTo" type="number" value={query.changedAtTo ?? ""} />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="sortField">Sort field</Label>
        <Select.Root type="single" bind:value={selectedSortField}>
          <Select.Trigger id="sortField" class="w-full">
            {selectedSortField}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="changedAt">changedAt</Select.Item>
            <Select.Item value="ref">ref</Select.Item>
            <Select.Item value="collection">collection</Select.Item>
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="sortField" value={selectedSortField} />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="sortDirection">Direction</Label>
        <Select.Root type="single" bind:value={selectedSortDirection}>
          <Select.Trigger id="sortDirection" class="w-full">
            {selectedSortDirection}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="desc">desc</Select.Item>
            <Select.Item value="asc">asc</Select.Item>
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="sortDirection" value={selectedSortDirection} />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="pageSize">Page size</Label>
        <Select.Root type="single" bind:value={selectedPageSize}>
          <Select.Trigger id="pageSize" class="w-full">
            {selectedPageSize}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="10">10</Select.Item>
            <Select.Item value="20">20</Select.Item>
            <Select.Item value="50">50</Select.Item>
            <Select.Item value="100">100</Select.Item>
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="pageSize" value={selectedPageSize} />
      </div>
    </div>

    <div class="mt-4 space-y-2">
      <div class="text-sm font-medium">Property filters</div>
      {#each propFilters as filter, idx}
        <div class="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]">
          <Input name="propKey" type="text" bind:value={filter.key} placeholder="key" />
          <Select.Root type="single" bind:value={filter.op}>
            <Select.Trigger class="w-full">
              {filter.op}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="eq">eq</Select.Item>
              <Select.Item value="contains">contains</Select.Item>
            </Select.Content>
          </Select.Root>
          <input type="hidden" name="propOp" value={filter.op} />
          <Input name="propValue" type="text" bind:value={filter.value} placeholder="value" />
          <Button type="button" variant="outline" onclick={() => removeFilterRow(idx)}>Remove</Button>
        </div>
      {/each}
      <Button type="button" variant="outline" onclick={addFilterRow}>Add filter</Button>
    </div>

    <input type="hidden" name="page" value="1" />

    <div class="mt-4 flex gap-2">
      <Button type="submit">Apply</Button>
      <Button variant="outline" href={basePath}>Reset</Button>
    </div>
  </form>

  <div class="rounded-lg border bg-card p-4">
    <div class="mb-2 text-sm font-medium">Live Query Payload</div>
    <pre class="overflow-auto rounded bg-muted p-3 text-xs">{previewJson}</pre>
  </div>

  <div class="rounded-lg border bg-card p-4">
    <div class="mb-3 text-sm text-muted-foreground">
      {result.total} result{result.total === 1 ? "" : "s"} • page {result.page}
      {#if result.totalPages > 0} of {result.totalPages}{/if}
    </div>

    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup}
          <Table.Row>
            {#each headerGroup.headers as header}
              <Table.Head>
                {#if !header.isPlaceholder}
                  <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#if table.getRowModel().rows?.length}
          {#each table.getRowModel().rows as row}
            <Table.Row>
              {#each row.getVisibleCells() as cell}
                <Table.Cell>
                  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        {:else}
          <Table.Row>
            <Table.Cell class="h-24 text-center" colspan={columns.length}>No items found</Table.Cell>
          </Table.Row>
        {/if}
      </Table.Body>
    </Table.Root>

    <div class="mt-4 flex flex-wrap gap-2 text-sm">
      <Button variant="outline" size="sm" href={createPageHref(1)}>First</Button>
      <Button variant="outline" size="sm" href={createPageHref(Math.max(1, result.page - 1))}>Prev</Button>
      <Button variant="outline" size="sm" href={createPageHref(result.page + 1)}>Next</Button>
      <Button
        variant="outline"
        size="sm"
        href={createPageHref(result.totalPages > 0 ? result.totalPages : 1)}
      >
        Last
      </Button>
    </div>
  </div>
</div>
