<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    getConsumer,
    updateConsumer,
    deleteConsumer,
    regenerateKey,
  } from "$lib/remote/consumers.remote";
  import {
    getConnectionsByConsumer,
    addConnection,
    removeConnection,
  } from "$lib/remote/connections.remote";
  import { getCollections } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const id = Number.parseInt(page.params.id ?? "", 10);
  const client = Number.isNaN(id) ? null : await getConsumer({ id });

  if (!client) {
    goto("/clients");
  }

  // Fetch connections and all collections for this client
  const connections = client ? await getConnectionsByConsumer({ consumerId: id }) : [];
  const allCollections = client ? await getCollections() : [];

  // Get available collections (not already connected)
  const connectedCollectionIds = new Set(connections.map((c) => c.collectionId));
  const availableCollections = allCollections.filter((c) => !connectedCollectionIds.has(c.id));

  let updateSuccess = $state(false);
  let regeneratedKey = $state<string | null>(null);
  let regeneratePending = $state(false);
  let regenerateError = $state<string | null>(null);
  let selectedCollectionId = $state<number | null>(
    availableCollections.length > 0 ? availableCollections[0].id : null,
  );

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }

  $effect(() => {
    if (updateConsumer.result?.success) {
      handleUpdateSuccess();
    }
  });

  async function handleRegenerateKey() {
    if (!client) return;

    regeneratePending = true;
    regeneratedKey = null;
    regenerateError = null;

    const formData = new FormData();
    formData.set("id", String(client.id));

    try {
      const response = await fetch(regenerateKey.action, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to regenerate API key.");
      }
      let result: { success?: boolean; key?: string } | null = null;
      try {
        result = await response.json();
      } catch {
        throw new Error("Failed to read API key response.");
      }
      if (result?.success && result.key) {
        regeneratedKey = result.key;
      } else {
        throw new Error("Failed to regenerate API key.");
      }
    } catch (error) {
      regenerateError =
        error instanceof Error ? error.message : "Failed to regenerate API key.";
    } finally {
      regeneratePending = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if client}
  <div class="container mx-auto max-w-2xl p-6">
    <div class="mb-6">
      <a href="/clients" class="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Clients
      </a>
    </div>

    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>Edit Client</Card.Title>
            <Card.Description>
              Update your client configuration and manage collection access.
            </Card.Description>
          </div>
        </div>
      </Card.Header>

      <Card.Content>
        <form
          method="post"
          action={updateConsumer.action}
          class="space-y-6"
        >
          <input type="hidden" name="id" value={client.id} />

          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="My Application"
              value={client.name ?? ""}
            />
            {#if updateConsumer.fields?.name?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateConsumer.fields?.name?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="rounded-lg border bg-muted/50 p-4">
            <h3 class="mb-2 text-sm font-medium">Client Information</h3>
            <dl class="space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Connected Collections:</dt>
                <dd class="font-medium">{client.connectionCount}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Created:</dt>
                <dd class="font-medium">
                  {new Date(client.createdAt * 1000).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {#if updateSuccess}
            <Alert.Root>
              <Alert.Title>Client updated</Alert.Title>
              <Alert.Description>Your changes have been saved.</Alert.Description>
            </Alert.Root>
          {/if}

          <div class="flex gap-3">
            <Button type="submit" disabled={!!updateConsumer.pending}>
              {updateConsumer.pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>

    <!-- API Key Section -->
    <Card.Root class="mt-6">
      <Card.Header>
        <Card.Title>API Key</Card.Title>
        <Card.Description>
          Regenerate the API key for this client. The new key will only be shown once.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {#if regenerateError}
          <Alert.Root class="mb-4" variant="destructive">
            <Alert.Title>API key regeneration failed</Alert.Title>
            <Alert.Description>{regenerateError}</Alert.Description>
          </Alert.Root>
        {/if}
        {#if regeneratedKey}
          <Alert.Root class="mb-4">
            <Alert.Title>New API Key Generated</Alert.Title>
            <Alert.Description>
              <p class="mb-2">
                Copy this key now. It will not be shown again.
              </p>
              <div class="flex items-center gap-2">
                <code class="flex-1 rounded bg-muted p-2 text-sm font-mono break-all">
                  {regeneratedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => copyToClipboard(regeneratedKey!)}
                >
                  Copy
                </Button>
              </div>
            </Alert.Description>
          </Alert.Root>
        {/if}
        <Button
          variant="outline"
          onclick={handleRegenerateKey}
          disabled={regeneratePending}
        >
          {regeneratePending ? "Regenerating..." : "Regenerate API Key"}
        </Button>
        <p class="mt-2 text-sm text-muted-foreground">
          Warning: Regenerating the API key will invalidate the current key. Any applications using the old key will need to be updated.
        </p>
      </Card.Content>
    </Card.Root>

    <!-- Collections Section -->
    <Card.Root class="mt-6">
      <Card.Header>
        <Card.Title>Connected Collections</Card.Title>
        <Card.Description>
          Manage which collections this client can access.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {#if connections.length === 0}
          <p class="text-sm text-muted-foreground">
            No collections connected. Add a collection below to grant access.
          </p>
        {:else}
          <div class="space-y-2">
            {#each connections as connection}
              <div class="flex items-center justify-between rounded-lg border p-3">
                <span class="font-medium">{connection.collectionName}</span>
                <form method="post" action={removeConnection.action}>
                  <input type="hidden" name="consumerId" value={client.id} />
                  <input type="hidden" name="collectionId" value={connection.collectionId} />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="submit"
                    class="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </form>
              </div>
            {/each}
          </div>
        {/if}

        {#if availableCollections.length > 0}
          <form method="post" action={addConnection.action} class="mt-4 flex gap-2">
            <input type="hidden" name="consumerId" value={client.id} />
            <select
              name="collectionId"
              class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              bind:value={selectedCollectionId}
            >
              {#each availableCollections as collection}
                <option value={collection.id}>{collection.name}</option>
              {/each}
            </select>
            <Button type="submit" variant="outline">
              Add Collection
            </Button>
          </form>
        {:else if connections.length > 0}
          <p class="mt-4 text-sm text-muted-foreground">
            All available collections are already connected.
          </p>
        {:else if allCollections.length === 0}
          <p class="mt-4 text-sm text-muted-foreground">
            No collections available. Create collections in your sources first.
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Danger Zone -->
    <Card.Root class="mt-6 border-destructive/50">
      <Card.Header>
        <Card.Title class="text-destructive">Danger Zone</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Delete this client</p>
            <p class="text-sm text-muted-foreground">
              This will permanently delete the client and revoke its API key.
            </p>
          </div>
          <form method="post" action={deleteConsumer.action}>
            <input type="hidden" name="id" value={client.id} />
            <Button
              variant="destructive"
              type="submit"
              onclick={(e: MouseEvent) => {
                if (
                  !confirm(
                    `Are you sure you want to delete "${client.name || "this client"}"? This action cannot be undone.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Delete Client
            </Button>
          </form>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{:else}
  <div class="container mx-auto max-w-2xl p-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Client not found</Alert.Title>
      <Alert.Description>
        The client you're looking for doesn't exist or you don't have access to it.
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href="/clients">Back to Clients</Button>
    </div>
  </div>
{/if}
