<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import { getCollections } from "$lib/remote/collections.remote";
  import {
    addConnection,
    getConnectionsByConsumer,
    removeConnection,
  } from "$lib/remote/connections.remote";
  import {
    deleteConsumer,
    getConsumer,
    regenerateKey,
    updateConsumer,
  } from "$lib/remote/consumers.remote";
  import { cn } from "$lib/utils";
  import { ClipboardIcon } from "@lucide/svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { fade } from "svelte/transition";

  const nameId = useId();

  const id = Number.parseInt(page.params.id ?? "", 10);
  const client = Number.isNaN(id) ? null : await getConsumer({ id });

  if (!client) {
    goto("/consumers");
  }

  const connections = client
    ? await getConnectionsByConsumer({ consumerId: id })
    : [];
  const allCollections = client ? await getCollections() : [];

  const connectedCollectionIds = new Set(
    connections.map((c) => c.collectionId),
  );
  const availableCollections = allCollections.filter(
    (c) => !connectedCollectionIds.has(c.id),
  );

  let updateSuccess = $state(false);
  let namePopoverOpen = $state(false);
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
      namePopoverOpen = false;
    }
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if client}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a
        href="/consumers"
        class="text-sm text-muted-foreground hover:text-foreground"
        >← Consumers</a
      >
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {client.name || "Unnamed Consumer"}
        </h1>
        <Popover.Root bind:open={namePopoverOpen}>
          <Popover.Trigger
            class={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Pencil class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="w-72" align="start">
              <form {...updateConsumer} class="space-y-3">
                <input {...updateConsumer.fields?.id.as("number")} type="hidden" value={client.id} />
                <div class="space-y-1.5">
                  <Label for={nameId}>Name</Label>
                  <Input
                    id={nameId}
                    {...updateConsumer.fields?.name.as("text")}
                    value={client.name ?? ""}
                    placeholder="My Application"
                    required
                  />
                </div>
                <div class="flex justify-end gap-2">
                  <Popover.Close>
                    <Button type="button" variant="outline" size="sm">Cancel</Button>
                  </Popover.Close>
                  <Button type="submit" size="sm" disabled={!!updateConsumer.pending}>
                    {updateConsumer.pending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        {client.connectionCount} collection{client.connectionCount === 1 ? "" : "s"} ·
        Created {new Date(client.createdAt).toLocaleDateString()}
      </p>
    </div>

    {#if updateSuccess}
      <Alert.Root class="mb-6">
        <Alert.Description>Consumer updated successfully.</Alert.Description>
      </Alert.Root>
    {/if}

    <!-- API Key -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        API Key
      </h2>

      {#if regenerateKey.result?.success}
        <div transition:fade>
          <Alert.Root class="mb-4">
            <Alert.Title>New API Key</Alert.Title>
            <Alert.Description>
              <p class="mb-2 text-xs">
                Copy this key now. It won't be shown again.
              </p>
              <div class="flex items-center gap-2 w-full">
                <code
                  class="flex-1 rounded bg-muted p-2 font-mono text-xs break-all"
                >
                  {regenerateKey.result?.key}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() =>
                    copyToClipboard(regenerateKey.result?.key ?? "")}
                >
                  <ClipboardIcon />
                  Copy
                </Button>
              </div>
            </Alert.Description>
          </Alert.Root>
        </div>
      {/if}

      <div
        class="flex items-center justify-between rounded-md border border-border p-4"
      >
        <div>
          <p class="text-sm font-medium">Regenerate key</p>
          <p class="text-xs text-muted-foreground">
            Current key will be revoked
          </p>
        </div>
        <form {...regenerateKey}>
          <input {...regenerateKey.fields?.id.as("number")} type="hidden" value={client.id} />
          <Button
            variant="outline"
            size="sm"
            disabled={!!regenerateKey.pending}
            type="submit"
          >
            {regenerateKey.pending ? "..." : "Regenerate"}
          </Button>
        </form>
      </div>
    </section>

    <!-- Connections -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Collections
      </h2>

      {#if connections.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">
          No collections connected.
        </p>
      {:else}
        <div
          class="mb-4 divide-y divide-border rounded-md border border-border"
        >
          {#each connections as connection}
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm font-medium"
                >{connection.collectionName}</span
              >
              <form {...removeConnection}>
                <input {...removeConnection.fields?.consumerId.as("number")} type="hidden" value={client.id} />
                <input {...removeConnection.fields?.collectionId.as("number")} type="hidden" value={connection.collectionId} />
                <button
                  type="submit"
                  class="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              </form>
            </div>
          {/each}
        </div>
      {/if}

      {#if availableCollections.length > 0}
        <form {...addConnection} class="flex gap-2">
          <input {...addConnection.fields?.consumerId.as("number")} type="hidden" value={client.id} />
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
        <p class="text-sm text-muted-foreground">
          No collections available. Create collections in your sources first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">
          All collections are connected.
        </p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete consumer</h3>
          <p class="text-sm text-muted-foreground">API key will be revoked.</p>
        </div>
        <form {...deleteConsumer}>
          <input {...deleteConsumer.fields?.id.as("number")} type="hidden" value={client.id} />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            onclick={(e: MouseEvent) => {
              if (!confirm(`Delete "${client.name || "this consumer"}"?`)) {
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
      <Alert.Title>Consumer not found</Alert.Title>
    </Alert.Root>
    <Button href="/consumers" class="mt-4">Back to Consumers</Button>
  </div>
{/if}
