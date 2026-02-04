<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    deleteSourceCollection,
    getSourceCollection,
    updateSourceCollection,
  } from "$lib/remote/source-collections.remote";
  import { getSource } from "$lib/remote/sources.remote";

  const sourceId = Number.parseInt(page.params.id ?? "", 10);
  const collectionId = Number.parseInt(page.params.collectionId ?? "", 10);

  const source = Number.isNaN(sourceId) ? null : await getSource({ id: sourceId });
  const collection = Number.isNaN(collectionId) || !source ? null : await getSourceCollection({ id: collectionId });

  if (!source) {
    await goto("/sources");
  } else if (!collection || collection.sourceId !== sourceId) {
    await goto(`/sources/${sourceId}`);
  }

  let updateSuccess = $state(false);

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => { updateSuccess = false; }, 3000);
  }

  $effect(() => {
    if (updateSourceCollection.result?.success) handleUpdateSuccess();
  });

  $effect(() => {
    const result = deleteSourceCollection.result as { success?: boolean } | undefined;
    if (result?.success) goto(`/sources/${sourceId}`);
  });
</script>

{#if source && collection}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/sources/{sourceId}" class="text-sm text-muted-foreground hover:text-foreground">← {source.name || "Source"}</a>
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">{collection.name || "Unnamed Collection"}</h1>
        {#if collection.connectionCount > 0}
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            Active
          </span>
        {:else}
          <span class="text-xs text-muted-foreground">No clients</span>
        {/if}
      </div>
      <p class="mt-1 text-sm text-muted-foreground">Configure collection from {source.name || "this source"}</p>
    </div>

    <!-- Edit form -->
    <form method="post" action={updateSourceCollection.action} class="space-y-4">
      <input type="hidden" name="id" value={collection.id} />

      <div class="space-y-1.5">
        <Label for="name">Name</Label>
        <Input id="name" name="name" type="text" placeholder="My Collection" value={collection.name ?? ""} />
        {#if updateSourceCollection.fields?.name?.issues()?.length}
          <p class="text-sm text-destructive">{updateSourceCollection.fields?.name?.issues()?.[0]?.message}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <Label for="ref">Reference</Label>
        <Input
          id="ref"
          name="ref"
          type="text"
          placeholder="Database ID or content type"
          value={collection.refString ?? ""}
        />
        <p class="text-xs text-muted-foreground">
          The upstream content identifier (e.g., Notion database ID).
        </p>
        {#if updateSourceCollection.fields?.ref?.issues()?.length}
          <p class="text-sm text-destructive">{updateSourceCollection.fields?.ref?.issues()?.[0]?.message}</p>
        {/if}
      </div>

      <!-- Info block -->
      <div class="rounded-md border border-border bg-muted/30 p-4">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted-foreground">Connected clients</dt>
          <dd class="text-right font-mono">{collection.connectionCount}</dd>
          <dt class="text-muted-foreground">Source</dt>
          <dd class="text-right">{source.name ?? "Unnamed"}</dd>
          <dt class="text-muted-foreground">Created</dt>
          <dd class="text-right">{new Date(collection.createdAt * 1000).toLocaleDateString()}</dd>
          {#if collection.updatedAt}
            <dt class="text-muted-foreground">Updated</dt>
            <dd class="text-right">{new Date(collection.updatedAt * 1000).toLocaleDateString()}</dd>
          {/if}
        </dl>
      </div>

      {#if updateSuccess}
        <Alert.Root>
          <Alert.Title>Changes saved</Alert.Title>
        </Alert.Root>
      {/if}

      <Button type="submit" disabled={!!updateSourceCollection.pending}>
        {updateSourceCollection.pending ? "Saving..." : "Save"}
      </Button>
    </form>

    <!-- Danger zone -->
    <section class="mt-8 rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete collection</h3>
          <p class="text-sm text-muted-foreground">All client connections will be removed.</p>
        </div>
        <form method="post" action={deleteSourceCollection.action}>
          <input type="hidden" name="id" value={collection.id} />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            disabled={!!deleteSourceCollection.pending}
            onclick={(e: MouseEvent) => {
              if (!confirm(`Delete "${collection.name || "this collection"}"?`)) {
                e.preventDefault();
              }
            }}
          >
            {deleteSourceCollection.pending ? "..." : "Delete"}
          </Button>
        </form>
      </div>
    </section>
  </div>
{:else if source && !collection}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Collection not found</Alert.Title>
    </Alert.Root>
    <Button href="/sources/{sourceId}" class="mt-4">Back to Source</Button>
  </div>
{:else}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
    </Alert.Root>
    <Button href="/sources" class="mt-4">Back to Sources</Button>
  </div>
{/if}
