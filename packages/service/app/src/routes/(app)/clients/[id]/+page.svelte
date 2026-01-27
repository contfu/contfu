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
  import * as Alert from "$lib/components/ui/alert";

  const id = Number.parseInt(page.params.id ?? "", 10);
  const client = Number.isNaN(id) ? null : await getConsumer({ id });

  if (!client) {
    goto("/clients");
  }

  const connections = client ? await getConnectionsByConsumer({ consumerId: id }) : [];
  const allCollections = client ? await getCollections() : [];

  const connectedCollectionIds = new Set(connections.map((c) => c.collectionId));
  const availableCollections = allCollections.filter((c) => !connectedCollectionIds.has(c.id));

  let updateSuccess = $state(false);
  let selectedCollectionId = $state<number | null>(
    availableCollections.length > 0 ? availableCollections[0].id : null,
  );

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => { updateSuccess = false; }, 3000);
  }

  $effect(() => {
    if (updateConsumer.result?.success) handleUpdateSuccess();
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if client}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/clients" class="text-sm text-muted-foreground hover:text-foreground">← Clients</a>
    </div>

    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">{client.name || "Unnamed Client"}</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage API access and collection connections</p>
    </div>

    <!-- Edit form -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Settings</h2>
      <form method="post" action={updateConsumer.action} class="space-y-4">
        <input type="hidden" name="id" value={client.id} />

        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" name="name" type="text" placeholder="My Application" value={client.name ?? ""} />
          {#if updateConsumer.fields?.name?.issues()?.length}
            <p class="text-sm text-destructive">{updateConsumer.fields?.name?.issues()?.[0]?.message}</p>
          {/if}
        </div>

        <div class="rounded-md border border-border bg-muted/30 p-4">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Connections</dt>
            <dd class="text-right font-mono">{client.connectionCount}</dd>
            <dt class="text-muted-foreground">Created</dt>
            <dd class="text-right">{new Date(client.createdAt * 1000).toLocaleDateString()}</dd>
          </dl>
        </div>

        {#if updateSuccess}
          <Alert.Root>
            <Alert.Title>Changes saved</Alert.Title>
          </Alert.Root>
        {/if}

        <Button type="submit" disabled={!!updateConsumer.pending}>
          {updateConsumer.pending ? "Saving..." : "Save"}
        </Button>
      </form>
    </section>

    <!-- API Key -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">API Key</h2>
      
      {#if regenerateKey.result?.key}
        <Alert.Root class="mb-4">
          <Alert.Title>New API Key</Alert.Title>
          <Alert.Description>
            <p class="mb-2 text-xs">Copy this key now. It won't be shown again.</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 rounded bg-muted p-2 font-mono text-xs break-all">
                {regenerateKey.result.key}
              </code>
              <Button variant="outline" size="sm" onclick={() => copyToClipboard(regenerateKey.result!.key)}>
                Copy
              </Button>
            </div>
          </Alert.Description>
        </Alert.Root>
      {/if}

      <div class="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p class="text-sm font-medium">Regenerate key</p>
          <p class="text-xs text-muted-foreground">Current key will be revoked</p>
        </div>
        <form method="post" action={regenerateKey.action}>
          <input type="hidden" name="id" value={client.id} />
          <Button variant="outline" size="sm" type="submit" disabled={!!regenerateKey.pending}>
            {regenerateKey.pending ? "..." : "Regenerate"}
          </Button>
        </form>
      </div>
    </section>

    <!-- Connections -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Collections</h2>

      {#if connections.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">No collections connected.</p>
      {:else}
        <div class="mb-4 divide-y divide-border rounded-md border border-border">
          {#each connections as connection}
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm font-medium">{connection.collectionName}</span>
              <form method="post" action={removeConnection.action}>
                <input type="hidden" name="consumerId" value={client.id} />
                <input type="hidden" name="collectionId" value={connection.collectionId} />
                <button type="submit" class="text-sm text-destructive hover:underline">
                  Remove
                </button>
              </form>
            </div>
          {/each}
        </div>
      {/if}

      {#if availableCollections.length > 0}
        <form method="post" action={addConnection.action} class="flex gap-2">
          <input type="hidden" name="consumerId" value={client.id} />
          <select
            name="collectionId"
            class="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            bind:value={selectedCollectionId}
          >
            {#each availableCollections as collection}
              <option value={collection.id}>{collection.name}</option>
            {/each}
          </select>
          <Button type="submit" variant="outline" size="sm">Add</Button>
        </form>
      {:else if allCollections.length === 0}
        <p class="text-sm text-muted-foreground">No collections available. Create collections in your sources first.</p>
      {:else}
        <p class="text-sm text-muted-foreground">All collections are connected.</p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete client</h3>
          <p class="text-sm text-muted-foreground">API key will be revoked.</p>
        </div>
        <form method="post" action={deleteConsumer.action}>
          <input type="hidden" name="id" value={client.id} />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            onclick={(e: MouseEvent) => {
              if (!confirm(`Delete "${client.name || "this client"}"?`)) {
                e.preventDefault();
              }
            }}
          >
            Delete
          </Button>
        </form>
      </div>
    </section>
  </div>
{:else}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Client not found</Alert.Title>
    </Alert.Root>
    <Button href="/clients" class="mt-4">Back to Clients</Button>
  </div>
{/if}
