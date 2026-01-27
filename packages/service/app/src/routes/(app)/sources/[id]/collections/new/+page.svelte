<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getSource } from "$lib/remote/sources.remote";
  import { createCollection } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });

  if (!source) {
    goto("/sources");
  }
</script>

{#if source}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/sources/{id}" class="text-sm text-muted-foreground hover:text-foreground">← {source.name || "Source"}</a>
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Add Collection</h1>
        <span class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
        </span>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">Configure content to sync from {source.name || "this source"}</p>
    </div>

    <form method="post" action={createCollection.action} class="space-y-5">
      <input type="hidden" name="sourceId" value={source.id} />

      <div class="space-y-1.5">
        <Label for="name">Name</Label>
        <Input id="name" name="name" type="text" placeholder="My Collection" required />
        {#if createCollection.fields?.name?.issues()?.length}
          <p class="text-sm text-destructive">{createCollection.fields?.name?.issues()?.[0]?.message}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        {#if source.type === 2}
          <Label for="ref">URLs to Fetch</Label>
          <Textarea
            id="ref"
            name="ref"
            placeholder="/page1&#10;/blog/article&#10;/products/item"
            rows={5}
          />
          <p class="text-xs text-muted-foreground">
            Relative URLs to fetch, one per line. Resolved against {source.url || "the base URL"}.
          </p>
        {:else}
          <Label for="ref">Reference</Label>
          <Input
            id="ref"
            name="ref"
            type="text"
            placeholder={source.type === 0 ? "Database ID" : "Content type (e.g., articles)"}
          />
          <p class="text-xs text-muted-foreground">
            {#if source.type === 0}
              The Notion database ID to sync.
            {:else}
              The Strapi content type API ID.
            {/if}
          </p>
        {/if}
        {#if createCollection.fields?.ref?.issues()?.length}
          <p class="text-sm text-destructive">{createCollection.fields?.ref?.issues()?.[0]?.message}</p>
        {/if}
      </div>

      <!-- Source info -->
      <div class="rounded-md border border-border bg-muted/30 p-4">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted-foreground">Source</dt>
          <dd class="text-right">{source.name || "Unnamed"}</dd>
          <dt class="text-muted-foreground">Type</dt>
          <dd class="text-right">{SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}</dd>
          {#if source.url}
            <dt class="text-muted-foreground">{source.type === 2 ? "Base URL" : "URL"}</dt>
            <dd class="truncate text-right" title={source.url}>{source.url}</dd>
          {/if}
        </dl>
      </div>

      <div class="flex gap-2 pt-2">
        <Button type="submit" disabled={!!createCollection.pending}>
          {createCollection.pending ? "Creating..." : "Create Collection"}
        </Button>
        <Button variant="outline" href="/sources/{id}">Cancel</Button>
      </div>
    </form>
  </div>
{:else}
  <div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
    </Alert.Root>
    <Button href="/sources" class="mt-4">Back to Sources</Button>
  </div>
{/if}
