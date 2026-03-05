<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import { Button } from "$lib/components/ui/button";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import * as Table from "$lib/components/ui/table";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
  });
</script>

<div class="container mx-auto max-w-6xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-lg"><span class="text-primary">$</span> contfu collections --list</h1>
    <CopyTextButton
      label="copy typings"
      copiedLabel="typings copied"
      failedLabel="copy failed"
      disabled={!data.combinedTypeString}
      text={data.combinedTypeString}
    />
  </div>

  <div class="overflow-x-auto border border-border bg-card p-4">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="text-muted-foreground">name</Table.Head>
          <Table.Head class="text-muted-foreground">ref</Table.Head>
          <Table.Head class="text-muted-foreground">item_count</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if data.collections.length === 0}
          <Table.Row>
            <Table.Cell colspan={3} class="py-6 text-center text-muted-foreground">
              -- no collections found --
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each data.collections as collection}
            <Table.Row>
              <Table.Cell>
                <Button
                  class="h-auto p-0"
                  variant="link"
                  href={`/collections/${encodeURIComponent(collection.name)}`}
                >
                  {collection.name}
                </Button>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground">{collection.ref}</Table.Cell>
              <Table.Cell>{collection.itemCount}</Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
    {#if data.collections.length > 0}
      <p class="mt-3 text-xs text-muted-foreground">{data.collections.length} {data.collections.length === 1 ? "result" : "results"}</p>
    {/if}
  </div>
</div>
