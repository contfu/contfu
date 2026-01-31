<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { getUsers, approveUser, revokeUser, promoteToAdmin, demoteFromAdmin } from "$lib/remote/admin.remote";
  import { UserRole } from "$lib/server/auth/user";

  const users = await getUsers();

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
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
        {users.filter((u) => !u.approved).length} pending
      </span>
      <span class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-sm">
        {users.length} total
      </span>
    </div>
  </div>

  <div class="overflow-hidden rounded-lg border border-border">
    <table class="w-full">
      <thead class="border-b border-border bg-muted/50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-medium">User</th>
          <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
          <th class="px-4 py-3 text-left text-sm font-medium">Role</th>
          <th class="px-4 py-3 text-left text-sm font-medium">Joined</th>
          <th class="px-4 py-3 text-right text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#each users as user (user.id)}
          <tr class="hover:bg-muted/30">
            <td class="px-4 py-3">
              <div>
                <p class="font-medium">{user.name}</p>
                <p class="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </td>
            <td class="px-4 py-3">
              {#if user.approved}
                <span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Approved
                </span>
              {:else}
                <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                  </svg>
                  Pending
                </span>
              {/if}
            </td>
            <td class="px-4 py-3">
              {#if user.role === UserRole.ADMIN}
                <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 14l-3-3 1.5-1.5L8 11l4.5-4.5L14 8l-6 6z" />
                  </svg>
                  Admin
                </span>
              {:else}
                <span class="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs">
                  User
                </span>
              {/if}
            </td>
            <td class="px-4 py-3 text-sm text-muted-foreground">
              {formatDate(user.createdAt)}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                {#if !user.approved}
                  <form method="post" action={approveUser.action}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" size="sm" disabled={!!approveUser.pending}>
                      {approveUser.pending ? "..." : "Approve"}
                    </Button>
                  </form>
                {:else}
                  <form method="post" action={revokeUser.action}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" size="sm" variant="outline" disabled={!!revokeUser.pending}>
                      {revokeUser.pending ? "..." : "Revoke"}
                    </Button>
                  </form>
                {/if}
                {#if user.role === UserRole.ADMIN}
                  <form method="post" action={demoteFromAdmin.action}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" size="sm" variant="outline" disabled={!!demoteFromAdmin.pending}>
                      {demoteFromAdmin.pending ? "..." : "Remove Admin"}
                    </Button>
                  </form>
                {:else}
                  <form method="post" action={promoteToAdmin.action}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" size="sm" variant="secondary" disabled={!!promoteToAdmin.pending}>
                      {promoteToAdmin.pending ? "..." : "Make Admin"}
                    </Button>
                  </form>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">
              No users yet
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
