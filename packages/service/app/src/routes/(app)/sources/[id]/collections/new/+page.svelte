<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getSource } from "$lib/remote/sources.remote";
  import { createCollection } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });

  if (!source) {
    goto("/sources");
  }
</script>

{#if source}
  <div class="container mx-auto max-w-2xl p-6">
    <div class="mb-6">
      <a
        href="/sources/{id}/collections"
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Collections
      </a>
    </div>

    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>Add New Collection</Card.Title>
            <Card.Description>
              Create a collection to sync content from {source.name || "this source"}.
            </Card.Description>
          </div>
          <span
            class="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
          </span>
        </div>
      </Card.Header>

      <Card.Content>
        <form method="post" action={createCollection.action} class="space-y-6">
          <input type="hidden" name="sourceId" value={source.id} />

          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="My Collection"
              required
            />
            <p class="text-sm text-muted-foreground">
              A descriptive name for this collection.
            </p>
            {#if createCollection.fields?.name?.issues()?.length}
              <p class="text-sm text-destructive">
                {createCollection.fields?.name?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="space-y-2">
            <Label for="ref">Reference (optional)</Label>
            <Input
              id="ref"
              name="ref"
              type="text"
              placeholder={source.type === 0 ? "Database ID" : "Content type API ID"}
            />
            <p class="text-sm text-muted-foreground">
              {#if source.type === 0}
                The Notion database ID to sync from.
              {:else}
                The Strapi content type API ID (e.g., "articles", "pages").
              {/if}
            </p>
            {#if createCollection.fields?.ref?.issues()?.length}
              <p class="text-sm text-destructive">
                {createCollection.fields?.ref?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="rounded-lg border bg-muted/50 p-4">
            <h3 class="mb-2 text-sm font-medium">Source Information</h3>
            <dl class="space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Source:</dt>
                <dd class="font-medium">{source.name || "Unnamed Source"}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Type:</dt>
                <dd class="font-medium">{SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}</dd>
              </div>
              {#if source.type === 1 && source.url}
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">URL:</dt>
                  <dd class="truncate font-medium" title={source.url}>{source.url}</dd>
                </div>
              {/if}
            </dl>
          </div>

          <div class="flex gap-3">
            <Button type="submit" disabled={!!createCollection.pending}>
              {createCollection.pending ? "Creating..." : "Create Collection"}
            </Button>
            <Button variant="outline" href="/sources/{id}/collections">Cancel</Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
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
