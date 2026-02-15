<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { getUsers } from "$lib/remote/admin.remote";
  import { UsersIcon } from "@lucide/svelte";
  import DataTable from "./data-table.svelte";
  import { columns } from "./columns.js";

  const users = await getUsers();

  const pendingCount = $derived(users.filter((u) => !u.approved).length);
</script>

<svelte:head>
  <title>Manage Users - Contfu Admin</title>
</svelte:head>

<SiteHeader icon={UsersIcon} title="User Management">
  <div class="ml-auto flex gap-2">
    <span class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-sm">
      {pendingCount} pending
    </span>
    <span class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-sm">
      {users.length} total
    </span>
  </div>
</SiteHeader>

<div class="p-6">
  <p class="mb-6 text-sm text-muted-foreground">
    Manage user access and roles
  </p>

  <DataTable data={users} {columns} />
</div>
