<script lang="ts">
  import { getConsumers, deleteConsumer } from "$lib/remote/consumers.remote";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const clients = await getConsumers();
</script>

<div class="container mx-auto max-w-5xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Clients</h1>
    <Button href="/clients/new">Add Client</Button>
  </div>

  {#if clients.length === 0}
    <Alert.Root>
      <Alert.Title>No clients configured</Alert.Title>
      <Alert.Description>
        Add your first client to generate an API key for accessing synced content.
      </Alert.Description>
    </Alert.Root>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each clients as client}
        <Card.Root class="flex flex-col">
          <Card.Header class="pb-2">
            <div class="flex items-center justify-between">
              <Card.Title>{client.name || "Unnamed Client"}</Card.Title>
            </div>
          </Card.Header>

          <Card.Content class="flex-1">
            <div class="space-y-2 text-sm text-muted-foreground">
              <div class="flex items-center justify-between">
                <span>Connections:</span>
                <span class="font-medium text-foreground">{client.connectionCount}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Created:</span>
                <span class="font-medium text-foreground">
                  {Number.isFinite(client.createdAt)
                    ? new Date(client.createdAt * 1000).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </Card.Content>

          <Card.Footer class="flex gap-2 pt-4">
            <Button variant="outline" size="sm" href="/clients/{client.id}">Edit</Button>
            <form method="post" action={deleteConsumer.action}>
              <input type="hidden" name="id" value={client.id} />
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                class="text-destructive hover:text-destructive"
                onclick={(e: MouseEvent) => {
                  if (!confirm("Are you sure you want to delete this client? All associated connections will also be deleted.")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </Button>
            </form>
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
