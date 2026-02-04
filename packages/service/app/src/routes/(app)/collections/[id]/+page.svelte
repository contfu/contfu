<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    getCollection,
    updateCollection,
    deleteCollection,
    getSourceCollectionMappings,
    addSourceCollection,
    removeSourceCollection,
  } from "$lib/remote/collections.remote";
  import { getSourceCollections } from "$lib/remote/source-collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Alert from "$lib/components/ui/alert";

  const id = Number.parseInt(page.params.id ?? "", 10);
  const collection = Number.isNaN(id) ? null : await getCollection({ id });

  if (!collection) {
    goto("/collections");
  }

  const mappings = collection ? await getSourceCollectionMappings({ collectionId: id }) : [];
  const allSourceCollections = collection ? await getSourceCollections() : [];

  const linkedSourceIds = new Set(mappings.map((m) => m.sourceCollectionId));
  const availableSourceCollections = allSourceCollections.filter(
    (sc) => !linkedSourceIds.has(sc.id),
  );

  let updateSuccess = $state(false);

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }

  $effect(() => {
    if (updateCollection.result?.success) handleUpdateSuccess();
  });
</script>

{#if collection}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/collections" class="text-sm text-muted-foreground hover:text-foreground">
        ← Collections
      </a>
    </div>

    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">{collection.name}</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {collection.sourceCollectionCount} source{collection.sourceCollectionCount === 1 ? "" : "s"} ·
        {collection.connectionCount} client{collection.connectionCount === 1 ? "" : "s"}
      </p>
    </div>

    {#if updateSuccess}
      <Alert.Root class="mb-6">
        <Alert.Description>Collection updated successfully.</Alert.Description>
      </Alert.Root>
    {/if}

    <!-- Update form -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Settings</h2>
      <form method="post" action={updateCollection.action} class="space-y-4">
        <input type="hidden" name="id" value={collection.id} />
        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" name="name" type="text" value={collection.name} required />
        </div>
        <Button type="submit" size="sm" disabled={!!updateCollection.pending}>
          {updateCollection.pending ? "Saving..." : "Save"}
        </Button>
      </form>
    </section>

    <!-- Source Collections -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Source Collections
      </h2>

      {#if mappings.length === 0}
        <p class="mb-4 text-sm text-muted-foreground">No source collections linked yet.</p>
      {:else}
        <div class="mb-4 divide-y divide-border rounded-md border border-border">
          {#each mappings as mapping}
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm font-medium">{mapping.sourceCollectionName}</span>
              <form method="post" action={removeSourceCollection.action}>
                <input type="hidden" name="collectionId" value={collection.id} />
                <input type="hidden" name="sourceCollectionId" value={mapping.sourceCollectionId} />
                <button type="submit" class="text-sm text-destructive hover:underline">
                  Remove
                </button>
              </form>
            </div>
          {/each}
        </div>
      {/if}

      {#if availableSourceCollections.length > 0}
        <p class="mb-2 text-sm text-muted-foreground">
          Link source collections from your sources:
        </p>
        <div class="flex flex-wrap gap-2">
          {#each availableSourceCollections as sc}
            <form method="post" action={addSourceCollection.action} class="inline">
              <input type="hidden" name="collectionId" value={collection.id} />
              <input type="hidden" name="sourceCollectionId" value={sc.id} />
              <Button type="submit" variant="outline" size="sm">
                + {sc.name}
              </Button>
            </form>
          {/each}
        </div>
      {:else if allSourceCollections.length === 0}
        <p class="text-sm text-muted-foreground">
          No source collections available. Create collections in your sources first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">All source collections are linked.</p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-destructive">
        Danger Zone
      </h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Deleting this collection will remove all mappings and client connections.
      </p>
      <form method="post" action={deleteCollection.action}>
        <input type="hidden" name="id" value={collection.id} />
        <Button type="submit" variant="destructive" size="sm">Delete Collection</Button>
      </form>
    </section>
  </div>
{/if}
