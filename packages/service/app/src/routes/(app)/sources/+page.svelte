<script lang="ts">
  import { getSources, deleteSource } from "$lib/remote/sources.remote";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const sources = await getSources();

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };
</script>

<div class="container mx-auto max-w-5xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Sources</h1>
    <Button href="/sources/new">Add Source</Button>
  </div>

  {#if sources.length === 0}
    <Alert.Root>
      <Alert.Title>No sources configured</Alert.Title>
      <Alert.Description>
        Add your first content source to start syncing data from Notion, Strapi, or the Web.
      </Alert.Description>
    </Alert.Root>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each sources as source}
        <Card.Root class="flex flex-col">
          <Card.Header class="pb-2">
            <div class="flex items-center justify-between">
              <Card.Title>{source.name || "Unnamed Source"}</Card.Title>
              <span
                class="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
              </span>
            </div>
          </Card.Header>

          <Card.Content class="flex-1">
            <div class="space-y-2 text-sm text-muted-foreground">
              <div class="flex items-center justify-between">
                <span>Collections:</span>
                <span class="font-medium text-foreground">{source.collectionCount}</span>
              </div>
              {#if source.url}
                <div class="flex items-center justify-between">
                  <span>URL:</span>
                  <span class="max-w-[150px] truncate font-medium text-foreground" title={source.url}>
                    {source.url}
                  </span>
                </div>
              {/if}
              <div class="flex items-center justify-between">
                <span>Created:</span>
                <span class="font-medium text-foreground">
                  {new Date(source.createdAt * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card.Content>

          <Card.Footer class="flex gap-2 pt-4">
            <Button variant="outline" size="sm" href="/sources/{source.id}">Edit</Button>
            <form method="post" action={deleteSource.action}>
              <input type="hidden" name="id" value={source.id} />
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                class="text-destructive hover:text-destructive"
                onclick={(e: MouseEvent) => {
                  if (!confirm("Are you sure you want to delete this source? All associated collections will also be deleted.")) {
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
