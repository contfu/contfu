<script lang="ts">
  import { getConsumers, deleteConsumer } from "$lib/remote/consumers.remote";
  import { Button } from "$lib/components/ui/button";

  const clients = await getConsumers();
</script>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Clients</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage API access for your applications</p>
    </div>
    <Button href="/clients/new">Add Client</Button>
  </div>

  {#if clients.length === 0}
    <div class="rounded-lg border border-dashed border-border p-12 text-center">
      <p class="text-muted-foreground">No clients configured</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Create a client to generate an API key for accessing your synced content.
      </p>
      <Button href="/clients/new" class="mt-4">Add your first client</Button>
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th class="px-4 py-3 text-right font-medium text-muted-foreground">Connections</th>
            <th class="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Created</th>
            <th class="px-4 py-3 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each clients as client}
            <tr class="hover:bg-muted/30">
              <td class="px-4 py-3">
                <a href="/clients/{client.id}" class="font-medium hover:underline">
                  {client.name || "Unnamed Client"}
                </a>
              </td>
              <td class="px-4 py-3 text-right font-mono">
                {client.connectionCount}
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {Number.isFinite(client.createdAt)
                  ? new Date(client.createdAt * 1000).toLocaleDateString()
                  : "—"}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <a href="/clients/{client.id}" class="text-primary hover:underline">Edit</a>
                  <form method="post" action={deleteConsumer.action} class="inline">
                    <input type="hidden" name="id" value={client.id} />
                    <button
                      type="submit"
                      class="text-destructive hover:underline"
                      onclick={(e: MouseEvent) => {
                        if (!confirm("Delete this client? The API key will be revoked.")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
