<script lang="ts" generics="TData, TValue">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    createSvelteTable,
    FlexRender,
  } from "$lib/components/ui/data-table/index.js";
  import { Input } from "$lib/components/ui/input";
  import { NativeSelect as Select } from "$lib/components/ui/native-select";
  import * as Table from "$lib/components/ui/table/index.js";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import {
    type ColumnDef,
    type ColumnFiltersState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
  } from "@tanstack/table-core";

  type DataTableProps = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
  };

  let { data, columns }: DataTableProps = $props();

  let { sorting, pagination } = $derived({
    sorting:
      page.url.searchParams
        .get("sorting")
        ?.split(",")
        .map((s) => ({ desc: s[0] === "d", id: s.slice(1) })) ?? [],
    pagination: {
      pageIndex: parseInt(page.url.searchParams.get("pageIndex") ?? "0"),
      pageSize: parseInt(page.url.searchParams.get("pageSize") ?? "2"),
    },
  });

  let columnFilters = $state<ColumnFiltersState>([]);
  let globalFilter = $state("");

  const table = createSvelteTable({
    get data() {
      return data;
    },
    get columns() {
      return columns;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const name = String(row.getValue("name") ?? "").toLowerCase();
      const email = String(
        (row.original as { email?: string }).email ?? "",
      ).toLowerCase();
      return name.includes(search) || email.includes(search);
    },
    onSortingChange: (updater) => {
      sorting = typeof updater === "function" ? updater(sorting) : updater;
      page.url.searchParams.set(
        "sorting",
        sorting.map((s) => `${s.desc ? "d" : "a"}${s.id}`).join(","),
      );
      replaceState(page.url, page.state);
    },
    onPaginationChange: (updater) => {
      pagination =
        typeof updater === "function" ? updater(pagination) : updater;
      page.url.searchParams.set("pageIndex", pagination.pageIndex.toString());
      page.url.searchParams.set("pageSize", pagination.pageSize.toString());
      replaceState(page.url, page.state);
    },
    onColumnFiltersChange: (updater) => {
      if (typeof updater === "function") {
        columnFilters = updater(columnFilters);
      } else {
        columnFilters = updater;
      }
    },
    onGlobalFilterChange: (updater) => {
      if (typeof updater === "function") {
        globalFilter = updater(globalFilter);
      } else {
        globalFilter = updater;
      }
    },
    state: {
      get sorting() {
        return sorting;
      },
      get columnFilters() {
        return columnFilters;
      },
      get pagination() {
        return pagination;
      },
      get globalFilter() {
        return globalFilter;
      },
    },
  });

  // Use table's API to set filters (ensures proper reactivity)
  function getStatusFilter(): string {
    const val = table.getColumn("approved")?.getFilterValue() as string;
    return val ?? "all";
  }

  function setStatusFilter(value: string) {
    const column = table.getColumn("approved");
    column?.setFilterValue(value === "all" ? undefined : value);
  }

  function getRoleFilter(): string {
    const val = table.getColumn("role")?.getFilterValue() as string;
    return val ?? "all";
  }

  function setRoleFilter(value: string) {
    const column = table.getColumn("role");
    column?.setFilterValue(value === "all" ? undefined : value);
  }

  function setGlobalFilter(value: string) {
    table.setGlobalFilter(value);
  }

  // Derived values to ensure reactivity
  const headerGroups = $derived(table.getHeaderGroups());
  const rowModel = $derived(table.getRowModel());
  const filteredRowCount = $derived(table.getFilteredRowModel().rows.length);
</script>

<div class="space-y-4">
  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-4">
    <Input
      placeholder="Search users..."
      class="max-w-sm"
      value={table.getState().globalFilter ?? ""}
      oninput={(e) => setGlobalFilter(e.currentTarget.value)}
    />
    <Select
      class="w-[150px]"
      value={getStatusFilter()}
      onchange={(e) => setStatusFilter(e.currentTarget.value)}
      options={[
        { value: "all", label: "All statuses" },
        { value: "approved", label: "Approved" },
        { value: "pending", label: "Pending" },
      ]}
    />
    <Select
      class="w-[120px]"
      value={getRoleFilter()}
      onchange={(e) => setRoleFilter(e.currentTarget.value)}
      options={[
        { value: "all", label: "All roles" },
        { value: "admin", label: "Admin" },
        { value: "user", label: "User" },
      ]}
    />
  </div>

  <!-- Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        {#each headerGroups as headerGroup (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              <Table.Head colspan={header.colSpan}>
                {#if !header.isPlaceholder}
                  {#if header.column.getCanSort()}
                    <button
                      class="flex items-center gap-1 hover:text-foreground"
                      onclick={() => header.column.toggleSorting()}
                    >
                      <FlexRender
                        content={header.column.columnDef.header}
                        context={header.getContext()}
                      />
                      {#if header.column.getIsSorted() === "asc"}
                        <ArrowUpIcon class="h-4 w-4" />
                      {:else if header.column.getIsSorted() === "desc"}
                        <ArrowDownIcon class="h-4 w-4" />
                      {:else}
                        <ArrowUpDownIcon class="h-4 w-4 opacity-50" />
                      {/if}
                    </button>
                  {:else}
                    <FlexRender
                      content={header.column.columnDef.header}
                      context={header.getContext()}
                    />
                  {/if}
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each rowModel.rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && "selected"}>
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell>
                <FlexRender
                  content={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-24 text-center">
              No users found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    <div class="flex items-center justify-end gap-2 space-x-2 p-4">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        Rows per page:
        <Select
          class="w-16"
          value={pagination.pageSize.toString()}
          onchange={(e) => table.setPageSize(parseInt(e.currentTarget.value))}
          options={[
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]}
        />
      </div>
      <span class="text-sm text-muted-foreground"
        >Page {pagination.pageIndex + 1} of {Math.ceil(
          data.length / pagination.pageSize,
        )}</span
      >
      <Button
        variant="outline"
        size="sm"
        onclick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        Next
      </Button>
    </div>
  </div>

  <!-- Footer info -->
  <div class="text-sm text-muted-foreground">
    Showing {filteredRowCount} of {data.length} users
  </div>
</div>
