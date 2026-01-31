<script lang="ts" generics="TData, TValue">
  import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
  } from "@tanstack/table-core";
  import { createSvelteTable, FlexRender } from "$lib/components/ui/data-table/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";

  type DataTableProps = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
  };

  let { data, columns }: DataTableProps = $props();

  let sorting = $state<SortingState>([]);
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
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const name = String(row.getValue("name") ?? "").toLowerCase();
      const email = String((row.original as { email?: string }).email ?? "").toLowerCase();
      return name.includes(search) || email.includes(search);
    },
    onSortingChange: (updater) => {
      if (typeof updater === "function") {
        sorting = updater(sorting);
      } else {
        sorting = updater;
      }
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
    get state() {
      return {
        sorting,
        columnFilters,
        globalFilter,
      };
    },
  });

  // Use table's API to set filters (ensures proper reactivity)
  function getStatusFilter(): string {
    const val = table.getColumn("approved")?.getFilterValue() as string;
    console.log("[DEBUG] getStatusFilter:", val);
    return val ?? "all";
  }

  function setStatusFilter(value: string) {
    console.log("[DEBUG] setStatusFilter called with:", value);
    const column = table.getColumn("approved");
    console.log("[DEBUG] approved column exists:", !!column);
    column?.setFilterValue(value === "all" ? undefined : value);
    console.log("[DEBUG] filter value after set:", column?.getFilterValue());
    console.log("[DEBUG] filtered rows:", table.getFilteredRowModel().rows.length);
  }

  function getRoleFilter(): string {
    const val = table.getColumn("role")?.getFilterValue() as string;
    console.log("[DEBUG] getRoleFilter:", val);
    return val ?? "all";
  }

  function setRoleFilter(value: string) {
    console.log("[DEBUG] setRoleFilter called with:", value);
    const column = table.getColumn("role");
    console.log("[DEBUG] role column exists:", !!column);
    column?.setFilterValue(value === "all" ? undefined : value);
    console.log("[DEBUG] filter value after set:", column?.getFilterValue());
    console.log("[DEBUG] filtered rows:", table.getFilteredRowModel().rows.length);
  }

  function setGlobalFilter(value: string) {
    console.log("[DEBUG] setGlobalFilter called with:", value);
    table.setGlobalFilter(value);
    console.log("[DEBUG] global filter value:", table.getState().globalFilter);
    console.log("[DEBUG] filtered rows:", table.getFilteredRowModel().rows.length);
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
    <Select.Root type="single" value={getStatusFilter()} onValueChange={setStatusFilter}>
      <Select.Trigger class="w-[150px]">
        {#if getStatusFilter() === "approved"}
          Approved
        {:else if getStatusFilter() === "pending"}
          Pending
        {:else}
          All statuses
        {/if}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all">All statuses</Select.Item>
        <Select.Item value="approved">Approved</Select.Item>
        <Select.Item value="pending">Pending</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root type="single" value={getRoleFilter()} onValueChange={setRoleFilter}>
      <Select.Trigger class="w-[120px]">
        {#if getRoleFilter() === "admin"}
          Admin
        {:else if getRoleFilter() === "user"}
          User
        {:else}
          All roles
        {/if}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all">All roles</Select.Item>
        <Select.Item value="admin">Admin</Select.Item>
        <Select.Item value="user">User</Select.Item>
      </Select.Content>
    </Select.Root>
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
                      <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                      {#if header.column.getIsSorted() === "asc"}
                        <ArrowUpIcon class="h-4 w-4" />
                      {:else if header.column.getIsSorted() === "desc"}
                        <ArrowDownIcon class="h-4 w-4" />
                      {:else}
                        <ArrowUpDownIcon class="h-4 w-4 opacity-50" />
                      {/if}
                    </button>
                  {:else}
                    <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
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
                <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
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
  </div>

  <!-- Footer info -->
  <div class="text-sm text-muted-foreground">
    Showing {filteredRowCount} of {data.length} users
  </div>
</div>
