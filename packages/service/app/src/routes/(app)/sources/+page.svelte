<script lang="ts">
  import { getSources, deleteSource } from "$lib/remote/sources.remote";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";

  const sources = await getSources();

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };
</script>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Sources</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage your content sources</p>
    </div>
    <Button href="/sources/new">Add Source</Button>
  </div>

  {#if sources.length === 0}
    <div class="rounded-lg border border-dashed border-border p-12 text-center">
      <p class="text-muted-foreground">No sources configured</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Connect a CMS like Notion, Strapi, or a web source to start syncing content.
      </p>
      <Button href="/sources/new" class="mt-4">Add your first source</Button>
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th class="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th class="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">URL</th>
            <th class="px-4 py-3 text-right font-medium text-muted-foreground">Collections</th>
            <th class="px-4 py-3 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each sources as source}
            <tr class="hover:bg-muted/30">
              <td class="px-4 py-3">
                <a href="/sources/{source.id}" class="font-medium hover:underline">
                  {source.name || "Unnamed Source"}
                </a>
                <div class="mt-0.5 text-xs text-muted-foreground">
                  Created {new Date(source.createdAt * 1000).toLocaleDateString()}
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
                </span>
              </td>
              <td class="hidden max-w-[200px] truncate px-4 py-3 text-muted-foreground sm:table-cell" title={source.url || ""}>
                {source.url || "—"}
              </td>
              <td class="px-4 py-3 text-right font-mono">
                {source.collectionCount}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <a href="/sources/{source.id}" class="text-primary hover:underline">Edit</a>
                  <form {...deleteSource} class="inline">
                    <input {...deleteSource.fields?.id.as("hidden")} value={source.id} />
                    <button
                      type="submit"
                      class="text-destructive hover:underline"
                      onclick={(e: MouseEvent) => {
                        if (!confirm("Delete this source? All collections will also be deleted.")) {
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
