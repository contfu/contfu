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
  import { getCollections } from "$lib/remote/collections.remote";
  import { getConsumers } from "$lib/remote/consumers.remote";
  import { getIncidentCount } from "$lib/remote/incidents.remote";
  import { getSources } from "$lib/remote/sources.remote";
  import {
    AlertTriangleIcon,
    DatabaseIcon,
    FoldersIcon,
    LayoutDashboardIcon,
    PencilIcon,
    PlusIcon,
    UsersIcon,
  } from "@lucide/svelte";

  const results = await Promise.allSettled([
    getSources(),
    getCollections(),
    getConsumers(),
  ]);

  const [sourcesResult, collectionsResult, consumersResult] = results;
  const sources =
    sourcesResult.status === "fulfilled" ? sourcesResult.value : [];
  const collections =
    collectionsResult.status === "fulfilled" ? collectionsResult.value : [];
  const consumers =
    consumersResult.status === "fulfilled" ? consumersResult.value : [];
  const hasLoadErrors = results.some((result) => result.status === "rejected");

  const incidentCountQuery = getIncidentCount();
  const incidentCount = $derived(incidentCountQuery?.current ?? 0);

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "notion",
    1: "strapi",
    2: "web",
  };
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
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{sources.length}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DatabaseIcon class="size-3" />
        sources
      </div>
    </div>
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{collections.length}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FoldersIcon class="size-3" />
        collections
      </div>
    </div>
    <div class="border border-border p-3">
      <div class="text-2xl font-semibold">{consumers.length}</div>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UsersIcon class="size-3" />
        consumers
      </div>
    </div>
  </div>

  <!-- Sources -->
  <section class="mb-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-xs text-muted-foreground">
        <span class="text-primary">$</span> contfu sources list
      </h2>
      <Button size="sm" href="/sources/new">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add</span>
      </Button>
    </div>

    {#if sources.length === 0}
      <div class="border border-dashed border-border p-8 text-center">
        <p class="text-xs text-muted-foreground">no sources configured</p>
        <Button variant="link" href="/sources/new" class="mt-2 text-xs">add source</Button>
      </div>
    {:else}
      <div class="border border-border">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">type</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">collections</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each sources.slice(0, 5) as source}
              <tr class="hover:bg-muted/30 transition-colors duration-100">
                <td class="px-3 py-2">
                  <a href="/sources/{source.id}" class="hover:text-primary transition-colors duration-150">
                    {source.name || "unnamed"}
                  </a>
                </td>
                <td class="px-3 py-2 text-muted-foreground">
                  {SOURCE_TYPE_LABELS[source.type] ?? "unknown"}
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {source.collectionCount}
                </td>
                <td class="px-3 py-2 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/sources/{source.id}" variant="ghost" size="icon-sm">
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
      {#if sources.length > 5}
        <div class="mt-2">
          <Button variant="link" href="/sources" class="h-auto p-0 text-xs">
            view all {sources.length} sources
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
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">sources</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">consumers</th>
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
                  {collection.influxCount}
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {collection.connectionCount}
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

  <!-- Consumers -->
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-xs text-muted-foreground">
        <span class="text-primary">$</span> contfu consumers list
      </h2>
      <Button size="sm" href="/consumers/new">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add</span>
      </Button>
    </div>

    {#if consumers.length === 0}
      <div class="border border-dashed border-border p-8 text-center">
        <p class="text-xs text-muted-foreground">no consumers configured</p>
        <Button variant="link" href="/consumers/new" class="mt-2 text-xs">add consumer</Button>
      </div>
    {:else}
      <div class="border border-border">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">connections</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each consumers.slice(0, 5) as consumer}
              <tr class="hover:bg-muted/30 transition-colors duration-100">
                <td class="px-3 py-2">
                  <a href="/consumers/{consumer.id}" class="hover:text-primary transition-colors duration-150">
                    {consumer.name || "unnamed"}
                  </a>
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {consumer.connectionCount}
                </td>
                <td class="px-3 py-2 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/consumers/{consumer.id}" variant="ghost" size="icon-sm">
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
      {#if consumers.length > 5}
        <div class="mt-2">
          <Button variant="link" href="/consumers" class="h-auto p-0 text-xs">
            view all {consumers.length} consumers
          </Button>
        </div>
      {/if}
    {/if}
  </section>
</div>
