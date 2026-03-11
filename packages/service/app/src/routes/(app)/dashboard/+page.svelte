<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "$lib/components/ui/tooltip";
  import { getQuota, getQuotaUsage } from "$lib/remote/billing.remote";
  import { getCollections } from "$lib/remote/collections.remote";
  import { listConnections } from "$lib/remote/connections.remote";
  import { getIncidentCount } from "$lib/remote/incidents.remote";
  import { getDashboardStats } from "$lib/remote/stats.remote";
  import { ConnectionTypeMeta } from "@contfu/svc-core";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import {
    AlertTriangleIcon,
    ArrowRightLeftIcon,
    BoxIcon,
    FoldersIcon,
    LayoutDashboardIcon,
    PencilIcon,
    PlugIcon,
    PlusIcon,
  } from "@lucide/svelte";

  const FREE_LIMITS = { maxConnections: 2, maxCollections: 5, maxFlows: 5, maxItems: 100 };

  const results = await Promise.allSettled([
    listConnections(),
    getCollections(),
    getDashboardStats(),
    getQuotaUsage(),
    getQuota(),
  ]);

  const [connectionsResult, collectionsResult, statsResult, quotaUsageResult, quotaDbResult] = results;
  const connections =
    connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
  const collections =
    collectionsResult.status === "fulfilled" ? collectionsResult.value : [];
  const stats =
    statsResult.status === "fulfilled" ? statsResult.value : null;
  // NATS quota (has live counts + limits), DB quota (has limits only), fallback to free tier
  const quotaUsage = quotaUsageResult.status === "fulfilled" ? quotaUsageResult.value : null;
  const quotaDb = quotaDbResult.status === "fulfilled" ? quotaDbResult.value : null;
  const limits = quotaDb ?? FREE_LIMITS;
  const hasLoadErrors = results.some((result) => result.status === "rejected");

  const connCount = quotaUsage?.connections ?? stats?.connectionCount ?? connections.length;
  const collCount = quotaUsage?.collections ?? stats?.collectionCount ?? collections.length;
  const flowCount = quotaUsage?.flows ?? stats?.flowCount ?? 0;
  const itemCount = quotaUsage?.items ?? stats?.totalItemCount ?? 0;

  const incidentCountQuery = getIncidentCount();
  const incidentCount = $derived(incidentCountQuery?.current ?? 0);

  function quotaPercent(current: number, max: number): number {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  }

  function itemsColor(current: number, max: number): string {
    if (max <= 0) return "bg-muted";
    const pct = (current / max) * 100;
    if (pct >= 90) return "bg-destructive";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-success";
  }

  function formatQuota(current: number, max: number): string {
    if (max === -1) return `${current} / unlimited`;
    return `${current} / ${max}`;
  }

</script>

<SiteHeader icon={LayoutDashboardIcon} title="dashboard" />

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu status
  </p>

  {#if hasLoadErrors}
    <Alert.Root class="mb-6" variant="destructive">
      <Alert.Title>ERR: partial load failure</Alert.Title>
      <Alert.Description>
        Some data failed to load. Try refreshing.
      </Alert.Description>
    </Alert.Root>
  {/if}

  {#if incidentCount > 0}
    <Alert.Root class="mb-6" variant="destructive">
      <AlertTriangleIcon class="size-4" />
      <Alert.Title>{incidentCount} incident{incidentCount === 1 ? "" : "s"}</Alert.Title>
      <Alert.Description>
        <a href="/incidents" class="underline hover:no-underline">view incidents</a>
      </Alert.Description>
    </Alert.Root>
  {/if}

  <!-- Stats -->
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{formatQuota(connCount, limits.maxConnections)}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <PlugIcon class="size-3" />
        connections
      </div>
      {#if limits.maxConnections > 0}
        <div class="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div class="bg-primary h-1.5 rounded-full transition-all" style="width: {quotaPercent(connCount, limits.maxConnections)}%"></div>
        </div>
      {/if}
    </div>
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{formatQuota(collCount, limits.maxCollections)}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FoldersIcon class="size-3" />
        collections
      </div>
      {#if limits.maxCollections > 0}
        <div class="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div class="bg-primary h-1.5 rounded-full transition-all" style="width: {quotaPercent(collCount, limits.maxCollections)}%"></div>
        </div>
      {/if}
    </div>
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{formatQuota(flowCount, limits.maxFlows)}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRightLeftIcon class="size-3" />
        flows
      </div>
      {#if limits.maxFlows > 0}
        <div class="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div class="bg-primary h-1.5 rounded-full transition-all" style="width: {quotaPercent(flowCount, limits.maxFlows)}%"></div>
        </div>
      {/if}
    </div>
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{formatQuota(itemCount, limits.maxItems)}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BoxIcon class="size-3" />
        item syncs
      </div>
      {#if limits.maxItems > 0}
        <div class="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div class="{itemsColor(itemCount, limits.maxItems)} h-1.5 rounded-full transition-all" style="width: {quotaPercent(itemCount, limits.maxItems)}%"></div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Connections -->
  <section class="mb-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-xs text-muted-foreground">
        <span class="text-primary">$</span> contfu connections list
      </h2>
      <Button size="sm" href="/connections">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add</span>
      </Button>
    </div>

    {#if connections.length === 0}
      <div class="border border-dashed border-border p-8 text-center">
        <p class="text-xs text-muted-foreground">no connections configured</p>
        <Button variant="link" href="/connections" class="mt-2 text-xs">add connection</Button>
      </div>
    {:else}
      <div class="border border-border">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">type</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each connections.slice(0, 5) as connection}
              <tr class="hover:bg-muted/30 transition-colors duration-100">
                <td class="px-3 py-2">
                  <a href="/connections/{connection.id}" class="hover:text-primary transition-colors duration-150">
                    {connection.name || "unnamed"}
                  </a>
                </td>
                <td class="px-3 py-2 text-muted-foreground">
                  <span class="flex items-center gap-1.5">
                    <ConnectionIcon type={connection.type} class="size-3" />
                    {ConnectionTypeMeta[connection.type]?.label ?? connection.type}
                  </span>
                </td>
                <td class="px-3 py-2 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/connections/{connection.id}" variant="ghost" size="icon-sm">
                          <PencilIcon class="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if connections.length > 5}
        <div class="mt-2">
          <Button variant="link" href="/connections" class="h-auto p-0 text-xs">
            view all {connections.length} connections
          </Button>
        </div>
      {/if}
    {/if}
  </section>

  <!-- Collections -->
  <section class="mb-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-xs text-muted-foreground">
        <span class="text-primary">$</span> contfu collections list
      </h2>
      <Button size="sm" href="/collections/new">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">new</span>
      </Button>
    </div>

    {#if collections.length === 0}
      <div class="border border-dashed border-border p-8 text-center">
        <p class="text-xs text-muted-foreground">no collections yet</p>
        <Button variant="link" href="/collections/new" class="mt-2 text-xs">create collection</Button>
      </div>
    {:else}
      <div class="border border-border">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">source flows</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">target flows</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each collections.slice(0, 5) as collection}
              <tr class="hover:bg-muted/30 transition-colors duration-100">
                <td class="px-3 py-2">
                  <a href="/collections/{collection.id}" class="hover:text-primary transition-colors duration-150">
                    {collection.name || "unnamed"}
                  </a>
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {collection.flowSourceCount}
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {collection.flowTargetCount}
                </td>
                <td class="px-3 py-2 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/collections/{collection.id}" variant="ghost" size="icon-sm">
                          <PencilIcon class="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if collections.length > 5}
        <div class="mt-2">
          <Button variant="link" href="/collections" class="h-auto p-0 text-xs">
            view all {collections.length} collections
          </Button>
        </div>
      {/if}
    {/if}
  </section>
</div>
