<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import * as Card from "$lib/components/ui/card";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import { getCollectionSchemasQuery } from "$lib/remote/collections.remote";
  import { getStats } from "$lib/remote/stats.remote";
  import { buildCollectionsSchemaJson } from "$lib/schema-export";
  import { onMount } from "svelte";

  const [stats, collectionSchemas] = $derived(
    await Promise.all([getStats(), getCollectionSchemasQuery()]),
  );

  const syncLabel = $derived(
    stats.sync.state === "connected"
      ? "connected"
      : stats.sync.state === "syncing"
        ? "syncing"
        : stats.sync.state === "connecting"
          ? "connecting"
          : stats.sync.state === "error"
            ? "error"
            : "disabled",
  );

  const syncColor = $derived(
    stats.sync.state === "connected"
      ? "text-success"
      : stats.sync.state === "syncing"
        ? "text-warning"
        : stats.sync.state === "error"
          ? "text-destructive"
          : "text-muted-foreground",
  );

  onMount(() => {
    const unsubscribeSync = subscribeLiveEvent("sync-status", () => {
      void invalidateAll();
    });
    const unsubscribeData = subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });

    return () => {
      unsubscribeSync();
      unsubscribeData();
    };
  });
</script>

<div class="container mx-auto max-w-5xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-lg"><span class="text-primary">$</span> contfu status</h1>
    <CopyTextButton
      label="copy schema"
      copiedLabel="schema copied"
      failedLabel="copy failed"
      disabled={collectionSchemas.length === 0}
      getText={() => buildCollectionsSchemaJson(collectionSchemas)}
    />
  </div>

  <!-- Overview Section -->
  <section class="mb-8">
    <h2 class="mb-4 text-sm text-muted-foreground uppercase tracking-widest">content overview</h2>
    <div class="border border-border bg-card p-4 line-reveal">
      <div class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">items</span><span class="mx-2 text-muted-foreground">=</span><span class="text-primary font-bold text-lg">{stats.itemCount}</span> <span class="text-muted-foreground text-xs">({stats.itemCount === 1 ? "1 synced page" : `${stats.itemCount} synced pages`})</span></p>
        <p><span class="text-muted-foreground">collections</span><span class="mx-2 text-muted-foreground">=</span><span class="text-primary font-bold text-lg">{stats.collectionCount}</span> <span class="text-muted-foreground text-xs">({stats.collectionCount === 1 ? "1 content collection" : `${stats.collectionCount} content collections`})</span></p>
        <p><span class="text-muted-foreground">assets</span><span class="mx-2 text-muted-foreground">=</span><span class="text-primary font-bold text-lg">{stats.assetCount}</span> <span class="text-muted-foreground text-xs">({stats.assetCount} found &middot; {stats.downloadedCount} downloaded &middot; {stats.processedCount} processed)</span></p>
      </div>
    </div>
  </section>

  <!-- Status Section -->
  <section class="mb-8">
    <h2 class="mb-4 text-sm text-muted-foreground uppercase tracking-widest">sync status</h2>
    <div class="border border-border bg-card p-4 mb-4">
      <div class="text-sm">
        <span class="text-muted-foreground">stream</span><span class="mx-2 text-muted-foreground">:</span><span class="{syncColor} font-bold">{syncLabel}</span>
        {#if stats.sync.reason}
          <span class="text-muted-foreground ml-2">({stats.sync.reason})</span>
        {/if}
      </div>
    </div>

    {#if stats.itemCount === 0 && stats.assetCount === 0}
      <Alert.Root>
        <Alert.Title>no content synced yet</Alert.Title>
        <Alert.Description>
          your local database is empty. connect to a contfu sync server to start
          receiving content.
        </Alert.Description>
      </Alert.Root>
    {:else}
      <div class="border border-border bg-card p-4">
        <p class="text-sm">
          <span class="text-muted-foreground">&gt;</span> local database contains {stats.itemCount}
          {stats.itemCount === 1 ? "item" : "items"} across {stats.collectionCount}
          {stats.collectionCount === 1 ? "collection" : "collections"}, with {stats.assetCount}
          {stats.assetCount === 1 ? "asset" : "assets"}
          ({stats.downloadedCount} downloaded, {stats.processedCount} processed).
        </p>
      </div>
    {/if}
  </section>
</div>
