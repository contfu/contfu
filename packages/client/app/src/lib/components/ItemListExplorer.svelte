<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import {
    createSvelteTable,
    FlexRender,
    renderSnippet,
  } from "$lib/components/ui/data-table";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "@contfu/ui";
  import * as Table from "$lib/components/ui/table";
  import { buildItemQuerySearchParams } from "$lib/query/item-query";
  import {
    createColumnHelper,
    getCoreRowModel,
    type Row,
  } from "@tanstack/table-core";
  import type {
    CollectionSummary,
    ItemData,
    QueryItemsInput,
    QueryItemsResult,
  } from "@contfu/client";

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

  let { query, result, collections, basePath, lockedCollection }: Props =
    $props();

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

  const ASSET_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

  function getIconUrl(item: ItemData): string | null {
    const val = item.props.icon ?? item.props.image;
    if (typeof val !== "string" || !val) return null;
    if (val.startsWith("http://") || val.startsWith("https://")) return val;
    if (ASSET_ID_RE.test(val)) return `/media/${val}`;
    return null;
  }

  function getTitle(item: ItemData): string {
    const val = item.props.title ?? item.props.name;
    if (typeof val === "string") return val;
    if (val != null) return String(val);
    return "";
  }

  const columnHelper = createColumnHelper<ItemData>();
  const columns = [
    columnHelper.display({
      id: "icon",
      header: "",
      cell: ({ row }) => renderSnippet(iconCell, { row }),
    }),
    columnHelper.accessor("id", {
      header: "id",
      cell: ({ row }) => renderSnippet(idCell, { row }),
    }),
    columnHelper.display({
      id: "title",
      header: "",
      cell: ({ row }) => renderSnippet(titleCell, { row }),
    }),
    columnHelper.accessor("collection", { header: "collection" }),
    columnHelper.accessor("changedAt", {
      header: "changedAt",
      cell: ({ row }) => renderSnippet(changedAtCell, { row }),
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

{#snippet iconCell({ row }: { row: Row<ItemData> })}
  {@const url = getIconUrl(row.original)}
  {#if url}
    <img src={url} alt="" class="h-8 w-8 rounded object-cover" loading="lazy" />
  {/if}
{/snippet}

{#snippet idCell({ row }: { row: Row<ItemData> })}
  <Button class="h-auto p-0 font-mono text-xs" variant="link" href={`/items/${row.original.id}`}>
    {row.original.id}
  </Button>
{/snippet}

{#snippet titleCell({ row }: { row: Row<ItemData> })}
  {@const title = getTitle(row.original)}
  {#if title}
    <span class="text-sm">{title}</span>
  {/if}
{/snippet}

{#snippet changedAtCell({ row }: { row: Row<ItemData> })}
  <time datetime={new Date(row.original.changedAt).toISOString()}>
    {new Date(row.original.changedAt).toLocaleString()}
  </time>
{/snippet}

<div class="space-y-6">
  <form method="GET" action={basePath} class="rounded-lg border bg-card p-4">
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {#if !lockedCollection}
        <div class="text-sm">
          <Label class="mb-1 block text-muted-foreground" for="collection"
            >Collection</Label
          >
          <Select
            id="collection"
            name="collection"
            class="w-full"
            bind:value={selectedCollection}
            options={[
              { value: "", label: "All collections" },
              ...collections.map((c) => ({ value: c.name, label: c.name })),
            ]}
          />
        </div>
      {/if}

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="changedAtFrom"
          >Changed from</Label
        >
        <Input
          id="changedAtFrom"
          name="changedAtFrom"
          type="number"
          value={query.changedAtFrom ?? ""}
        />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="changedAtTo"
          >Changed to</Label
        >
        <Input
          id="changedAtTo"
          name="changedAtTo"
          type="number"
          value={query.changedAtTo ?? ""}
        />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="sortField"
          >Sort field</Label
        >
        <Select
          id="sortField"
          name="sortField"
          class="w-full"
          bind:value={selectedSortField}
          options={[
            { value: "changedAt", label: "changedAt" },
            { value: "collection", label: "collection" },
          ]}
        />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="sortDirection"
          >Direction</Label
        >
        <Select
          id="sortDirection"
          name="sortDirection"
          class="w-full"
          bind:value={selectedSortDirection}
          options={[
            { value: "desc", label: "desc" },
            { value: "asc", label: "asc" },
          ]}
        />
      </div>

      <div class="text-sm">
        <Label class="mb-1 block text-muted-foreground" for="pageSize"
          >Page size</Label
        >
        <Select
          id="pageSize"
          name="pageSize"
          class="w-full"
          bind:value={selectedPageSize}
          options={[
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]}
        />
      </div>
    </div>

    <div class="mt-4 space-y-2">
      <div class="text-sm font-medium">Property filters</div>
      {#each propFilters as filter, idx}
        <div class="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]">
          <Input
            name="propKey"
            type="text"
            bind:value={filter.key}
            placeholder="key"
          />
          <Select
            name="propOp"
            class="w-full"
            bind:value={filter.op}
            options={[
              { value: "eq", label: "eq" },
              { value: "contains", label: "contains" },
            ]}
          />
          <Input
            name="propValue"
            type="text"
            bind:value={filter.value}
            placeholder="value"
          />
          <Button
            type="button"
            variant="outline"
            onclick={() => removeFilterRow(idx)}>Remove</Button
          >
        </div>
      {/each}
      <Button type="button" variant="outline" onclick={addFilterRow}
        >Add filter</Button
      >
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
      {#if result.totalPages > 0}
        of {result.totalPages}{/if}
    </div>

    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup}
          <Table.Row>
            {#each headerGroup.headers as header}
              <Table.Head>
                {#if !header.isPlaceholder}
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
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
                  <FlexRender
                    content={cell.column.columnDef.cell}
                    context={cell.getContext()}
                  />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        {:else}
          <Table.Row>
            <Table.Cell class="h-24 text-center" colspan={columns.length}
              >No items found</Table.Cell
            >
          </Table.Row>
        {/if}
      </Table.Body>
    </Table.Root>

    <div class="mt-4 flex flex-wrap gap-2 text-sm">
      <Button variant="outline" size="sm" href={createPageHref(1)}>First</Button
      >
      <Button
        variant="outline"
        size="sm"
        href={createPageHref(Math.max(1, result.page - 1))}>Prev</Button
      >
      <Button variant="outline" size="sm" href={createPageHref(result.page + 1)}
        >Next</Button
      >
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
