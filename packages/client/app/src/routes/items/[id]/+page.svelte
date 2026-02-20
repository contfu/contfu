<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto max-w-4xl space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Item Detail</h1>
    <Button href="/items" variant="ghost" size="sm">Back to items</Button>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{data.item.ref}</Card.Title>
      <Card.Description>{data.item.collection}</Card.Description>
    </Card.Header>
    <Card.Content>
      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted-foreground">ID</dt>
          <dd class="font-mono text-xs">{data.item.id}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Changed At</dt>
          <dd>{data.item.changedAt}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base">Properties</Card.Title>
    </Card.Header>
    <Card.Content>
      <pre class="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.item.props, null, 2)}</pre>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base">Content</Card.Title>
    </Card.Header>
    <Card.Content>
      {#if data.item.content}
        <pre class="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.item.content, null, 2)}</pre>
      {:else}
        <p class="text-sm text-muted-foreground">No content available</p>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
