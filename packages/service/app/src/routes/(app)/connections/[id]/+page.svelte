<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    deleteConnection,
    getConnection,
    getConnectionTypes,
    updateConnection,
    regenerateWebhookSecret,
    regenerateApiKey,
    testConnection,
  } from "$lib/remote/connections.remote";
  import {
    getCollectionsByConnection,
    discoverCollections,
    importCollections,
    type DiscoveredCollection,
  } from "$lib/remote/collections.remote";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import {
    BoxesIcon,
    CheckIcon,
    ClipboardCopyIcon,
    KeyIcon,
    LoaderCircleIcon,
    PlugIcon,
    PlusIcon,
    RefreshCwIcon,
    ScanIcon,
    TrashIcon,
  } from "@lucide/svelte";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import { ConnectionType } from "@contfu/core";
  import { ConnectionTypeMeta } from "@contfu/svc-core";
  import { toast } from "svelte-sonner";
  import TypeScriptIcon from "$lib/components/icons/TypeScriptIcon.svelte";

  let { params } = $props();
  let id = $derived(params.id);

  const connectionQuery = $derived(id !== "new" ? getConnection({ id }) : null);
  const connection = $derived(await connectionQuery);
  const quota = $derived(await getQuotaUsage());

  // Scan collections
  let scanning = $state(false);
  let scanned = $state<DiscoveredCollection[]>([]);
  let selectedRefs = $state<Set<string>>(new Set());
  let addingToContfu = $state(false);
  let scanError = $state<string | null>(null);

  const collectionsQuery = $derived(
    id !== "new" ? getCollectionsByConnection({ connectionId: id }) : null,
  );
  const collections = $derived(await collectionsQuery);

  const canScan = $derived(
    connection?.type === ConnectionType.NOTION || connection?.type === ConnectionType.STRAPI,
  );

  // Auto-scan when entering a scannable connection with no collections
  let autoScanned = $state(false);
  $effect(() => {
    if (collections?.length === 0 && !atCollectionLimit && canScan && !scanning && !autoScanned) {
      autoScanned = true;
      void handleScan();
    }
  });
  const addableCount = $derived(
    scanned.filter((d) => selectedRefs.has(d.ref) && !d.alreadyImported).length,
  );
  const remainingCollections = $derived(
    quota === null || quota.maxCollections === -1 ? Infinity : quota.maxCollections - quota.collections,
  );
  const exceedsCollectionLimit = $derived(
    isFinite(remainingCollections) && addableCount > remainingCollections,
  );
  const atCollectionLimit = $derived(remainingCollections <= 0);

  async function handleScan() {
    scanning = true;
    scanError = null;
    scanned = [];
    try {
      scanned = await discoverCollections({ connectionId: id });
      selectedRefs = new Set(scanned.filter((d) => !d.alreadyImported).map((d) => d.ref));
    } catch (e) {
      scanError = e instanceof Error ? e.message : "Scan failed";
    } finally {
      scanning = false;
    }
  }

  function toggleRef(ref: string) {
    const next = new Set(selectedRefs);
    if (next.has(ref)) next.delete(ref);
    else next.add(ref);
    selectedRefs = next;
  }

  async function handleAddToContfu() {
    addingToContfu = true;
    scanError = null;
    try {
      const items = scanned
        .filter((d) => selectedRefs.has(d.ref) && !d.alreadyImported)
        .map((d) => ({ ref: d.ref, displayName: d.displayName }));
      await importCollections({ connectionId: id, items });
      scanned = [];
      selectedRefs = new Set();
      await Promise.all([collectionsQuery?.refresh(), getQuotaUsage().refresh()]);
    } catch (e) {
      scanError = e instanceof Error ? e.message : "Import failed";
    } finally {
      addingToContfu = false;
    }
  }

  // Types generation
  let typesOutput = $state<string | null>(null);
  let loadingTypes = $state(false);

  // Webhook secret
  let webhookSecret = $state<string | null>(null);

  // API key (CLIENT connections)
  let apiKey = $state<string | null>(null);

  async function handleRegenerateApiKey() {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) return;
    try {
      const result = await regenerateApiKey({ id });
      if (result.apiKey) {
        apiKey = result.apiKey;
        toast.success("New API key generated");
      }
    } catch {
      toast.error("Failed to regenerate API key");
    }
  }

  // Test connection
  let testing = $state(false);

  // Edit name
  let editingName = $state(false);
  let nameValue = $state("");

  function startEditName() {
    nameValue = connection?.name ?? "";
    editingName = true;
  }

  async function saveName() {
    if (!nameValue.trim()) return;
    try {
      await updateConnection({ id, name: nameValue.trim() });
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      editingName = false;
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${connection?.name}"? All collections and flows will be removed.`))
      return;
    try {
      await deleteConnection({ id });
      toast.success("Connection deleted");
      goto("/connections");
    } catch {
      toast.error("Failed to delete connection");
    }
  }

  async function handleGenerateTypes() {
    loadingTypes = true;
    try {
      typesOutput = await getConnectionTypes({ id });
    } catch {
      toast.error("Failed to generate types");
    } finally {
      loadingTypes = false;
    }
  }

  async function handleRegenerateWebhookSecret() {
    if (!confirm("Regenerate webhook secret? The old secret will stop working.")) return;
    try {
      const result = await regenerateWebhookSecret({ id });
      if (result.secret) {
        webhookSecret = result.secret;
        toast.success("New webhook secret generated");
      }
    } catch {
      toast.error("Failed to regenerate webhook secret");
    }
  }

  async function handleTestConnection() {
    testing = true;
    try {
      const result = await testConnection({ id });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      testing = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }
</script>

<SiteHeader>
  <a
    href="/connections"
    class="text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; connections
  </a>
</SiteHeader>

{#if connection}
  <div class="page-shell px-4 py-8 sm:px-6">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2">
        {#if editingName}
          <form
            class="flex items-center gap-2"
            onsubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <Input
              bind:value={nameValue}
              class="text-2xl font-semibold"
              autofocus
              onkeydown={(e) => { if (e.key === "Escape") editingName = false; }}
            />
            <Button type="submit" variant="ghost" size="icon-sm">
              <CheckIcon class="size-4" />
            </Button>
          </form>
        {:else}
          <h1 class="text-2xl font-semibold tracking-tight">{connection.name}</h1>
          <Button variant="ghost" size="icon-sm" onclick={startEditName}>
            <span class="sr-only">Rename</span>
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </Button>
        {/if}
      </div>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <ConnectionIcon type={connection.type} class="size-4" />
        {ConnectionTypeMeta[connection.type]?.label ?? connection.type} · {connection.collectionCount} collection{connection.collectionCount === 1 ? "" : "s"}
        {#if connection.uid}
          · uid: <code class="text-xs">{connection.uid}</code>
        {/if}
      </p>
    </div>

    <!-- Connection Info -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Connection
      </h2>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Status</span>
          {#if connection.type === ConnectionType.APP}
            {#if connection.isConnected}
              <span class="inline-flex items-center gap-1.5 text-xs text-success">
                <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
                connected
              </span>
            {:else if connection.hasCredentials}
              <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>
                not connected
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5 text-xs text-destructive">
                <span class="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                no api key
              </span>
            {/if}
          {:else if connection.hasCredentials}
            <span class="inline-flex items-center gap-1.5 text-xs text-success">
              <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
              active
            </span>
          {:else}
            <span class="inline-flex items-center gap-1.5 text-xs text-destructive">
              <span class="h-1.5 w-1.5 rounded-full bg-destructive"></span>
              no credentials
            </span>
          {/if}
        </div>

        {#if connection.type !== ConnectionType.APP}
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={handleTestConnection} disabled={testing}>
              {#if testing}
                <LoaderCircleIcon class="size-3 animate-spin" />
              {:else}
                <PlugIcon class="size-3" />
              {/if}
              Test Connection
            </Button>
            <Button variant="outline" size="sm" onclick={handleRegenerateWebhookSecret}>
              <RefreshCwIcon class="size-3" />
              Regenerate Webhook Secret
            </Button>
          </div>
        {/if}

        {#if webhookSecret}
          <div class="rounded-md border border-border bg-muted/50 p-3">
            <p class="mb-1 text-xs font-medium text-muted-foreground">Webhook Secret (copy now, shown once)</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 break-all text-xs">{webhookSecret}</code>
              <Button variant="ghost" size="icon-sm" onclick={() => copyToClipboard(webhookSecret!)}>
                <ClipboardCopyIcon class="size-3" />
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Collections -->
    <section class="mb-8 rounded-lg border border-border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Collections
        </h2>
        {#if canScan}
          <Button variant="outline" size="sm" onclick={handleScan} disabled={scanning}>
            {#if scanning}
              <LoaderCircleIcon class="size-3 animate-spin" />
            {:else}
              <ScanIcon class="size-3" />
            {/if}
            {scanning ? "scanning..." : "scan"}
          </Button>
        {:else if connection.type === ConnectionType.APP}
          <Button
            variant="outline"
            size="sm"
            href={atCollectionLimit ? undefined : `/collections/new?connectionId=${id}`}
            disabled={atCollectionLimit}
          >
            <PlusIcon class="size-3" />
            new collection
          </Button>
        {/if}
      </div>

      {#if atCollectionLimit && connection.type === ConnectionType.APP}
        <p class="mb-3 text-xs text-muted-foreground">
          Collection limit reached ({quota?.collections}/{quota?.maxCollections}).
          <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more.
        </p>
      {/if}

      {#if collections && collections.length > 0}
        <div class="mb-4 space-y-2">
          {#each collections as col}
            <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <a href="/collections/{col.id}" class="flex items-center gap-1.5 text-sm hover:text-primary transition-colors duration-150">
                {#if col.icon?.type === "emoji"}
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{col.icon.value}</span>
                {:else if col.icon?.type === "image"}
                  <img src={col.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                {:else}
                  <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                {/if}
                {col.displayName ?? col.name}
              </a>
              <span class="text-xs text-muted-foreground">
                {col.flowSourceCount} source · {col.flowTargetCount} target
              </span>
            </div>
          {/each}
        </div>
      {:else if scanned.length === 0}
        <p class="text-sm text-muted-foreground">No collections bound to this connection.</p>
      {/if}

      {#if scanned.length > 0}
        <div class="mt-2 divide-y divide-border border border-border">
          {#each scanned as ds}
            <label class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 {ds.alreadyImported ? 'opacity-50' : ''}">
              <input
                type="checkbox"
                disabled={ds.alreadyImported}
                checked={selectedRefs.has(ds.ref)}
                onchange={() => toggleRef(ds.ref)}
              />
              {#if ds.icon?.type === "emoji"}
                <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{ds.icon.value}</span>
              {:else if ds.icon?.type === "image"}
                <img src={ds.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
              {:else}
                <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
              {/if}
              <span class="flex-1">{ds.displayName}</span>
              {#if ds.alreadyImported}
                <span class="text-muted-foreground">already added</span>
              {/if}
            </label>
          {/each}
        </div>
        <div class="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onclick={handleAddToContfu}
            disabled={addingToContfu || addableCount === 0 || exceedsCollectionLimit}
          >
            {addingToContfu ? "adding..." : `add ${addableCount} to contfu`}
          </Button>
          <Button size="sm" variant="ghost" onclick={() => { scanned = []; selectedRefs = new Set(); }}>
            cancel
          </Button>
        </div>
        {#if exceedsCollectionLimit}
          <p class="mt-2 text-xs text-muted-foreground">
            Only {remainingCollections} collection{remainingCollections === 1 ? "" : "s"} remaining on your plan.
            Deselect some or <a href="/billing" class="underline hover:text-foreground">upgrade</a> to add more.
          </p>
        {/if}
      {/if}

      {#if scanError}
        <p class="mt-2 text-xs text-destructive">{scanError}</p>
      {/if}
    </section>

    <!-- API Key (CLIENT connections) -->
    {#if connection.type === ConnectionType.APP}
      <section class="mb-8 rounded-lg border border-border p-4">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          API Key
        </h2>
        <p class="mb-3 text-xs text-muted-foreground">
          Used to authenticate requests from this client. Regenerate to invalidate the current key.
        </p>
        <Button variant="outline" size="sm" onclick={handleRegenerateApiKey}>
          <RefreshCwIcon class="size-3" />
          Regenerate API Key
        </Button>
        {#if apiKey}
          <div class="mt-3 rounded-md border border-border bg-muted/50 p-3">
            <p class="mb-1 text-xs font-medium text-muted-foreground">API Key (copy now, shown once)</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 break-all text-xs">{apiKey}</code>
              <Button variant="ghost" size="icon-sm" onclick={() => copyToClipboard(apiKey!)}>
                <ClipboardCopyIcon class="size-3" />
              </Button>
            </div>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Types Generation (CLIENT connections) -->
    {#if connection.type === ConnectionType.APP}
      <section class="mb-8 rounded-lg border border-border p-4">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          TypeScript Types
        </h2>
        <p class="mb-3 text-xs text-muted-foreground">
          Generate TypeScript types for all collections connected to this consumer.
        </p>
        <Button variant="outline" size="sm" onclick={handleGenerateTypes} disabled={loadingTypes}>
          {#if loadingTypes}
            <LoaderCircleIcon class="size-3 animate-spin" />
          {:else}
            <TypeScriptIcon class="size-3" />
          {/if}
          Generate Types
        </Button>
        {#if typesOutput !== null}
          <div class="mt-3 relative">
            <Button
              variant="ghost"
              size="icon-sm"
              class="absolute right-2 top-2"
              onclick={() => copyToClipboard(typesOutput!)}
            >
              <ClipboardCopyIcon class="size-3" />
            </Button>
            <pre class="max-h-96 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">{typesOutput || "// No collections to generate types for"}</pre>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Danger Zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-destructive">
        Danger Zone
      </h2>
      <p class="mb-3 text-sm text-muted-foreground">
        Deleting this connection will remove all its collections and flows.
      </p>
      <Button variant="destructive" size="sm" onclick={handleDelete}>
        <TrashIcon class="size-4" />
        Delete Connection
      </Button>
    </section>
  </div>
{/if}
