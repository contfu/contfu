<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import * as Alert from "$lib/components/ui/alert";
  import CopyTextButton from "$lib/components/CopyTextButton.svelte";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import * as Card from "$lib/components/ui/card";
  import { getCollectionSchemasQuery } from "$lib/remote/collections.remote";
  import { buildCollectionsSchemaJson } from "$lib/schema-export";
  import { getStats } from "$lib/remote/stats.remote";
  import { onMount } from "svelte";

  const [stats, collectionSchemas] = await Promise.all([getStats(), getCollectionSchemasQuery()]);

  const syncLabel =
    stats.sync.state === "connected"
      ? "Connected"
      : stats.sync.state === "syncing"
        ? "Syncing"
        : stats.sync.state === "connecting"
          ? "Connecting"
          : stats.sync.state === "error"
            ? "Error"
            : "Disabled";

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
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <CopyTextButton
      label="Copy schema"
      copiedLabel="Schema copied"
      failedLabel="Copy failed"
      disabled={collectionSchemas.length === 0}
      getText={() => buildCollectionsSchemaJson(collectionSchemas)}
    />
  </div>

  <!-- Overview Section -->
  <section class="mb-8">
    <h2 class="mb-4 text-lg font-semibold">Content Overview</h2>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>Total Items</Card.Description>
          <Card.Title class="text-3xl">{stats.itemCount}</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-xs text-muted-foreground">
            {stats.itemCount === 1
              ? "1 synced page"
              : `${stats.itemCount} synced pages`}
          </p>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>Collections</Card.Description>
          <Card.Title class="text-3xl">{stats.collectionCount}</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-xs text-muted-foreground">
            {stats.collectionCount === 1
              ? "1 content collection"
              : `${stats.collectionCount} content collections`}
          </p>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Description>Assets</Card.Description>
          <Card.Title class="text-3xl">{stats.assetCount}</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-xs text-muted-foreground">
            {stats.assetCount === 1
              ? "1 media file"
              : `${stats.assetCount} media files`}
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </section>

  <!-- Status Section -->
  <section class="mb-8">
    <h2 class="mb-4 text-lg font-semibold">Sync Status</h2>
    <Card.Root class="mb-4">
      <Card.Header class="pb-2">
        <Card.Title class="text-base">Connection</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground">
          Service stream: <span class="font-medium text-foreground">{syncLabel}</span>
          {#if stats.sync.reason}
            ({stats.sync.reason})
          {/if}
        </p>
      </Card.Content>
    </Card.Root>

    {#if stats.itemCount === 0 && stats.assetCount === 0}
      <Alert.Root>
        <Alert.Title>No content synced yet</Alert.Title>
        <Alert.Description>
          Your local database is empty. Connect to a Contfu sync server to start
          receiving content.
        </Alert.Description>
      </Alert.Root>
    {:else}
      <Card.Root>
        <Card.Header class="pb-2">
          <Card.Title class="text-base">Content Ready</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Your local database contains {stats.itemCount}
            {stats.itemCount === 1 ? "item" : "items"} across {stats.collectionCount}
            {stats.collectionCount === 1 ? "collection" : "collections"}, with {stats.assetCount}
            {stats.assetCount === 1 ? "asset" : "assets"}.
          </p>
        </Card.Content>
      </Card.Root>
    {/if}
  </section>
</div>
