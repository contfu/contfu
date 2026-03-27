<script lang="ts">
  import { getUsers } from "$lib/remote/admin.remote";
  import DataTable from "./data-table.svelte";
  import { columns } from "./columns.js";

  const users = $derived(await getUsers());

  const pendingCount = $derived(users.filter((u) => !u.approved).length);
</script>

<svelte:head>
  <title>Manage Users - Contfu Admin</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6 flex items-center gap-2">
    <p class="text-xs text-muted-foreground">
      <span class="text-primary">$</span> contfu admin users --list
    </p>
    <div class="ml-auto flex gap-2">
      <span class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-sm">
        {pendingCount} pending
      </span>
      <span class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-sm">
        {users.length} total
      </span>
    </div>
  </div>

  <DataTable data={users} {columns} />
</div>
