<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    deleteCollection,
    getCollection,
    updateCollection,
  } from "$lib/remote/collections.remote";
  import { getSource } from "$lib/remote/sources.remote";

  const SYNC_STATUS_LABELS: Record<
    string,
    { label: string; variant: "default" | "secondary" }
  > = {
    active: { label: "Active", variant: "default" },
    inactive: { label: "No clients", variant: "secondary" },
  };

  const sourceId = Number.parseInt(page.params.id ?? "", 10);
  const collectionId = Number.parseInt(page.params.collectionId ?? "", 10);

  const source = Number.isNaN(sourceId)
    ? null
    : await getSource({ id: sourceId });
  const collection =
    Number.isNaN(collectionId) || !source
      ? null
      : await getCollection({ id: collectionId });

  // Redirect if source or collection not found
  if (!source) {
    await goto("/sources");
  } else if (!collection || collection.sourceId !== sourceId) {
    await goto(`/sources/${sourceId}`);
  }

  // Compute sync status from collection connection count
  const syncStatus = collection
    ? getSyncStatus(collection.connectionCount)
    : "inactive";

  let updateSuccess = $state(false);

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }

  $effect(() => {
    if (updateCollection.result?.success) {
      handleUpdateSuccess();
    }
  });

  $effect(() => {
    const result = deleteCollection.result as { success?: boolean } | undefined;
    if (result?.success) {
      goto(`/sources/${sourceId}`);
    }
  });

  function getSyncStatus(connectionCount: number): string {
    return connectionCount > 0 ? "active" : "inactive";
  }
</script>

{#if source && collection}
  <div class="container mx-auto max-w-2xl p-6">
    <div class="mb-6">
      <a
        href="/sources/{sourceId}"
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Source
      </a>
    </div>

    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>Edit Collection</Card.Title>
            <Card.Description>
              Update your collection configuration for {source.name ??
                "this source"}.
            </Card.Description>
          </div>
          <span
            class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {SYNC_STATUS_LABELS[
              syncStatus
            ]?.variant === 'default'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-secondary text-secondary-foreground'}"
          >
            {SYNC_STATUS_LABELS[syncStatus]?.label ?? "Unknown"}
          </span>
        </div>
      </Card.Header>

      <Card.Content>
        <form
          method="post"
          action={updateCollection.action}
          class="space-y-6"
        >
          <input type="hidden" name="id" value={collection.id} />

          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="My Collection"
              value={collection.name ?? ""}
            />
            {#if updateCollection.fields?.name?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateCollection.fields?.name?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="space-y-2">
            <Label for="ref">Collection Reference</Label>
            <Input
              id="ref"
              name="ref"
              type="text"
              placeholder="e.g., database ID or content type"
              value={collection.ref
                ? new TextDecoder().decode(collection.ref)
                : ""}
            />
            <p class="text-sm text-muted-foreground">
              The reference identifier for the upstream content (e.g., Notion
              database ID).
            </p>
            {#if updateCollection.fields?.ref?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateCollection.fields?.ref?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="rounded-lg border bg-muted/50 p-4">
            <h3 class="mb-2 text-sm font-medium">Sync Status</h3>
            <dl class="space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Connected clients:</dt>
                <dd class="font-medium">{collection.connectionCount}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Source:</dt>
                <dd class="font-medium">{source.name ?? "Unnamed Source"}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Created:</dt>
                <dd class="font-medium">
                  {new Date(collection.createdAt * 1000).toLocaleString()}
                </dd>
              </div>
              {#if collection.updatedAt}
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Last updated:</dt>
                  <dd class="font-medium">
                    {new Date(collection.updatedAt * 1000).toLocaleString()}
                  </dd>
                </div>
              {/if}
            </dl>
          </div>

          {#if updateSuccess}
            <Alert.Root>
              <Alert.Title>Collection updated</Alert.Title>
              <Alert.Description
                >Your changes have been saved.</Alert.Description
              >
            </Alert.Root>
          {/if}

          <div class="flex gap-3">
            <Button type="submit" disabled={!!updateCollection.pending}>
              {updateCollection.pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card.Content>

      <Card.Footer class="border-t pt-6">
        <div class="flex w-full items-center justify-between">
          <div>
            <h3 class="text-sm font-medium text-destructive">Danger Zone</h3>
            <p class="text-sm text-muted-foreground">
              Deleting this collection will disconnect all clients.
            </p>
          </div>
          <form method="post" action={deleteCollection.action}>
            <input type="hidden" name="id" value={collection.id} />
            <Button
              variant="destructive"
              type="submit"
              disabled={!!deleteCollection.pending}
              onclick={(e: MouseEvent) => {
                if (
                  !confirm(
                    `Are you sure you want to delete "${collection.name || "this collection"}"? This action cannot be undone.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              {deleteCollection.pending ? "Deleting..." : "Delete Collection"}
            </Button>
          </form>
        </div>
      </Card.Footer>
    </Card.Root>
  </div>
{:else if source && !collection}
  <div class="container mx-auto max-w-2xl p-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Collection not found</Alert.Title>
      <Alert.Description>
        The collection you're looking for doesn't exist or you don't have access
        to it.
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href="/sources/{sourceId}">Back to Source</Button>
    </div>
  </div>
{:else}
  <div class="container mx-auto max-w-2xl p-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
      <Alert.Description>
        The source you're looking for doesn't exist or you don't have access to
        it.
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href="/sources">Back to Sources</Button>
    </div>
  </div>
{/if}
