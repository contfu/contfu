<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getSource } from "$lib/remote/sources.remote";
  import { getSourceCollectionsBySource, deleteSourceCollection } from "$lib/remote/source-collections.remote";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
  const collections = source ? await getSourceCollectionsBySource({ sourceId: id }) : [];

  if (!source) {
    goto("/sources");
  }
</script>

{#if source}
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/sources/{id}" class="text-sm text-muted-foreground hover:text-foreground">← {source.name || "Source"}</a>
    </div>

    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">Collections</h1>
          <span class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
          </span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {source.name || "Source"} · {collections.length} collection{collections.length !== 1 ? "s" : ""}
        </p>
      </div>
      <Button href="/sources/{id}/collections/new">Add Collection</Button>
    </div>

    {#if collections.length === 0}
      <div class="rounded-lg border border-dashed border-border p-12 text-center">
        <p class="text-muted-foreground">No collections configured</p>
        <Button variant="link" href="/sources/{id}/collections/new" class="mt-2">Add your first collection →</Button>
      </div>
    {:else}
      <div class="overflow-hidden rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th class="px-4 py-3 text-right font-medium text-muted-foreground">Clients</th>
              <th class="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Created</th>
              <th class="px-4 py-3 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each collections as collection}
              <tr class="hover:bg-muted/30">
                <td class="px-4 py-3">
                  <a href="/sources/{id}/collections/{collection.id}" class="font-medium hover:underline">
                    {collection.name || "Unnamed Collection"}
                  </a>
                </td>
                <td class="px-4 py-3 text-right font-mono">
                  {collection.connectionCount}
                </td>
                <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {new Date(collection.createdAt * 1000).toLocaleDateString()}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <a href="/sources/{id}/collections/{collection.id}" class="text-primary hover:underline">Edit</a>
                    <form method="post" action={deleteSourceCollection.action} class="inline">
                      <input type="hidden" name="id" value={collection.id} />
                      <button
                        type="submit"
                        class="text-destructive hover:underline"
                        onclick={(e: MouseEvent) => {
                          if (!confirm("Delete this collection?")) {
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
{:else}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
    </Alert.Root>
    <Button href="/sources" class="mt-4">Back to Sources</Button>
  </div>
{/if}
