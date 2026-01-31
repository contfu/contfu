<script lang="ts">
  import { getUsers } from "$lib/remote/admin.remote";
  import DataTable from "./data-table.svelte";
  import { columns } from "./columns.js";

  const users = await getUsers();

  const pendingCount = $derived(users.filter((u) => !u.approved).length);
</script>

<svelte:head>
  <title>Manage Users - Contfu Admin</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">User Management</h1>
      <p class="text-muted-foreground">Manage user access and roles</p>
    </div>
    <div class="flex gap-2">
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
