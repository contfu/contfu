<script lang="ts">
  import ItemListExplorer from "$lib/components/ItemListExplorer.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Collection: {data.collection.name}</h1>
    <Button href="/collections" variant="ghost" size="sm">Back to collections</Button>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{data.collection.name}</Card.Title>
      <Card.Description>Collection detail</Card.Description>
    </Card.Header>
    <Card.Content>
      <dl class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-muted-foreground">Ref</dt>
          <dd>{data.collection.ref}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Items</dt>
          <dd>{data.collection.itemCount}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Created</dt>
          <dd>{data.collection.createdAt}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Updated</dt>
          <dd>{data.collection.updatedAt ?? "-"}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>

  <ItemListExplorer
    basePath={`/collections/${encodeURIComponent(data.collection.name)}`}
    query={data.query}
    collections={data.collections}
    result={data.result}
    lockedCollection={data.collection.name}
  />
</div>
