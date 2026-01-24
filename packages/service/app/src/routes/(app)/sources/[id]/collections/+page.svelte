<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getSource } from "$lib/remote/sources.remote";
  import { getCollectionsBySource, deleteCollection } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
  const collections = source ? await getCollectionsBySource({ sourceId: id }) : [];

  if (!source) {
    goto("/sources");
  }
</script>

{#if source}
  <div class="container mx-auto max-w-5xl p-6">
    <div class="mb-6">
      <a href="/sources/{id}" class="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Source
      </a>
    </div>

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Collections</h1>
        <p class="text-sm text-muted-foreground">
          Collections for {source.name || "Unnamed Source"}
          <span
            class="ml-2 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
          </span>
        </p>
      </div>
      <Button href="/sources/{id}/collections/new">Add Collection</Button>
    </div>

    {#if collections.length === 0}
      <Alert.Root>
        <Alert.Title>No collections</Alert.Title>
        <Alert.Description>
          Add your first collection to start syncing content from this source.
        </Alert.Description>
      </Alert.Root>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each collections as collection}
          <Card.Root class="flex flex-col">
            <Card.Header class="pb-2">
              <Card.Title>{collection.name || "Unnamed Collection"}</Card.Title>
            </Card.Header>

            <Card.Content class="flex-1">
              <div class="space-y-2 text-sm text-muted-foreground">
                <div class="flex items-center justify-between">
                  <span>Connected clients:</span>
                  <span class="font-medium text-foreground">{collection.connectionCount}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Created:</span>
                  <span class="font-medium text-foreground">
                    {new Date(collection.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card.Content>

            <Card.Footer class="flex gap-2 pt-4">
              <Button variant="outline" size="sm" href="/sources/{id}/collections/{collection.id}">
                Manage
              </Button>
              <form method="post" action={deleteCollection.action}>
                <input type="hidden" name="id" value={collection.id} />
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  class="text-destructive hover:text-destructive"
                  onclick={(e: MouseEvent) => {
                    if (
                      !confirm(
                        "Are you sure you want to delete this collection? All associated connections will also be deleted.",
                      )
                    ) {
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
{:else}
  <div class="container mx-auto max-w-2xl p-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
      <Alert.Description>
        The source you're looking for doesn't exist or you don't have access to it.
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href="/sources">Back to Sources</Button>
    </div>
  </div>
{/if}
