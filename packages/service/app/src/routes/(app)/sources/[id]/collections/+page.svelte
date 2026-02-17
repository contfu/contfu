<script lang="ts">
  import { page } from "$app/state";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import {
    deleteSourceCollection,
    getSourceCollectionsBySource,
  } from "$lib/remote/source-collections.remote";
  import { getSource } from "$lib/remote/sources.remote";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };

  const id = page.params.id ?? "";
  const source = id ? await getSource({ id }) : null;

  // Query object - auto-refreshes after form submissions
  const collections = source ? getSourceCollectionsBySource({ sourceId: id }) : null;

</script>

<SiteHeader title="Source Collections">
  <a
    href="/sources/{id}"
    class="ml-auto text-sm text-muted-foreground hover:text-foreground"
  >
    ← {source?.name || "Source"}
  </a>
</SiteHeader>

{#if source && collections}
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div class="mb-6 flex items-center gap-3">
      <span
        class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
      >
        {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
      </span>
      <p class="text-sm text-muted-foreground">
        Available data from {source.name || "this source"}. Use these in your
        Collections.
      </p>
    </div>

    {#if collections.loading || !collections.current}
      <p class="text-muted-foreground">Loading...</p>
    {:else if collections.current.length === 0}
      <div class="rounded-lg border border-dashed border-border p-12 text-center">
        <p class="text-muted-foreground">No source collections discovered yet.</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Source collections are automatically discovered when syncing with the upstream source.
        </p>
      </div>
    {:else}
      <div class="overflow-hidden rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th class="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Discovered</th>
              <th class="px-4 py-3 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each collections.current as collection}
              {@const del = deleteSourceCollection.for(collection.id)}
              <tr>
                <td class="px-4 py-3 font-medium">{collection.name || "Unnamed"}</td>
                <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {new Date(collection.createdAt).toLocaleDateString()}
                </td>
                <td class="px-4 py-3 text-right">
                  <form {...del} class="inline">
                    <input {...del.fields.id.as("text")} type="hidden" value={collection.id} />
                    <button
                      type="submit"
                      class="text-destructive hover:underline"
                      onclick={(e: MouseEvent) => {
                        if (!confirm("Remove this source collection?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="mt-4 text-sm text-muted-foreground">
        To use these in your app, <a href="/collections" class="text-primary hover:underline">create a Collection</a> and link these source collections to it.
      </p>
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
