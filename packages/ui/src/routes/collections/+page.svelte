<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import { getCollectionsQuery, getCombinedCollectionTypesQuery } from "$lib/remote/collections.remote";
  import * as Table from "$lib/components/ui/table";
  import { onMount } from "svelte";

  const [collections, combinedTypeString] = $derived(
    await Promise.all([getCollectionsQuery(), getCombinedCollectionTypesQuery()]),
  );

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
  });
</script>

<div class="page-shell p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-lg"><span class="text-primary">$</span> contfu collections list</h1>
    <CopyTextButton
      label="copy typings"
      copiedLabel="typings copied"
      failedLabel="copy failed"
      disabled={!combinedTypeString}
      text={combinedTypeString}
    />
  </div>

  <div class="overflow-x-auto border border-border bg-card p-4">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="text-muted-foreground">name</Table.Head>
          <Table.Head class="text-muted-foreground">item_count</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if collections.length === 0}
          <Table.Row>
            <Table.Cell colspan={2} class="py-6 text-center text-muted-foreground">
              -- no collections found --
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each collections as collection}
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
              <Table.Cell>{collection.itemCount}</Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
    {#if collections.length > 0}
      <p class="mt-3 text-xs text-muted-foreground">{collections.length} {collections.length === 1 ? "result" : "results"}</p>
    {/if}
  </div>
</div>
