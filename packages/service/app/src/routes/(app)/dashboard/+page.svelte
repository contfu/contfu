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
  import { getConnections } from "$lib/remote/connections.remote";
  import { getConsumers } from "$lib/remote/consumers.remote";
  import { getIncidentCount } from "$lib/remote/incidents.remote";
  import { getSources } from "$lib/remote/sources.remote";
  import {
    AlertTriangleIcon,
    DatabaseIcon,
    FoldersIcon,
    LayoutDashboardIcon,
    Link2Icon,
    PencilIcon,
    PlusIcon,
    UsersIcon,
  } from "@lucide/svelte";

  const results = await Promise.allSettled([
    getSources(),
    getCollections(),
    getConsumers(),
    getConnections(),
  ]);

  const [sourcesResult, collectionsResult, consumersResult, connectionsResult] =
    results;
  const sources =
    sourcesResult.status === "fulfilled" ? sourcesResult.value : [];
  const collections =
    collectionsResult.status === "fulfilled" ? collectionsResult.value : [];
  const consumers =
    consumersResult.status === "fulfilled" ? consumersResult.value : [];
  const connections =
    connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
  const hasLoadErrors = results.some((result) => result.status === "rejected");

  const incidentCountQuery = getIncidentCount();
  const incidentCount = $derived(incidentCountQuery?.current ?? 0);

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };
</script>

<SiteHeader icon={LayoutDashboardIcon} title="Dashboard" />

<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">

  {#if hasLoadErrors}
    <Alert.Root class="mb-6" variant="destructive">
      <Alert.Title>Some data failed to load</Alert.Title>
      <Alert.Description>
        Parts of the dashboard are unavailable. Try refreshing the page.
      </Alert.Description>
    </Alert.Root>
  {/if}

  {#if incidentCount > 0}
    <Alert.Root class="mb-6" variant="destructive">
      <AlertTriangleIcon class="size-4" />
      <Alert.Title>{incidentCount} sync incident{incidentCount === 1 ? "" : "s"}</Alert.Title>
      <Alert.Description>
        <a href="/incidents" class="underline hover:no-underline">View incidents →</a>
      </Alert.Description>
    </Alert.Root>
  {/if}

  <!-- Stats row -->
  <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div class="rounded-lg border border-border border-l-2 border-l-primary/20 p-3">
      <div class="text-2xl font-semibold">{sources.length}</div>
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <DatabaseIcon class="size-4" />
        Sources
      </div>
    </div>
    <div class="rounded-lg border border-border border-l-2 border-l-primary/20 p-3">
      <div class="text-2xl font-semibold">{collections.length}</div>
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <FoldersIcon class="size-4" />
        Collections
      </div>
    </div>
    <div class="rounded-lg border border-border border-l-2 border-l-primary/20 p-3">
      <div class="text-2xl font-semibold">{consumers.length}</div>
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <UsersIcon class="size-4" />
        Consumers
      </div>
    </div>
    <div class="rounded-lg border border-border border-l-2 border-l-primary/20 p-3">
      <div class="text-2xl font-semibold">{connections.length}</div>
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link2Icon class="size-4" />
        Connections
      </div>
    </div>
  </div>

  <!-- Sources section -->
  <section class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Sources
      </h2>
      <Button size="sm" href="/sources/new">
        <PlusIcon class="size-4" />
        <span class="hidden sm:inline">Add Source</span>
      </Button>
    </div>

    {#if sources.length === 0}
      <div
        class="rounded-lg border border-dashed border-border p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">No sources configured</p>
        <Button variant="link" href="/sources/new" class="mt-2"
          >Add your first source →</Button
        >
      </div>
    {:else}
      <div class="overflow-hidden rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th
                class="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >Name</th
              >
              <th
                class="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >Type</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
                >Collections</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
              ></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each sources.slice(0, 5) as source}
              <tr class="hover:bg-muted/30">
                <td class="px-4 py-3">
                  <a
                    href="/sources/{source.id}"
                    class="font-medium hover:underline"
                  >
                    {source.name || "Unnamed"}
                  </a>
                </td>
                <td class="px-4 py-3 text-muted-foreground">
                  {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
                </td>
                <td
                  class="px-4 py-3 text-right font-mono text-muted-foreground"
                >
                  {source.collectionCount}
                </td>
                <td class="px-4 py-3 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/sources/{source.id}" variant="ghost" size="icon-sm">
                          <PencilIcon class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
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
          <Button variant="link" href="/sources" class="h-auto p-0 text-sm"
            >View all {sources.length} sources →</Button
          >
        </div>
      {/if}
    {/if}
  </section>

  <!-- Collections section -->
  <section class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Collections
      </h2>
      <Button size="sm" href="/collections/new">
        <PlusIcon class="size-4" />
        <span class="hidden sm:inline">New Collection</span>
      </Button>
    </div>

    {#if collections.length === 0}
      <div
        class="rounded-lg border border-dashed border-border p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">No collections yet</p>
        <Button variant="link" href="/collections/new" class="mt-2"
          >Create your first collection →</Button
        >
      </div>
    {:else}
      <div class="overflow-hidden rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th
                class="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >Name</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
                >Sources</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
                >Consumers</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
              ></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each collections.slice(0, 5) as collection}
              <tr class="hover:bg-muted/30">
                <td class="px-4 py-3">
                  <a
                    href="/collections/{collection.id}"
                    class="font-medium hover:underline"
                  >
                    {collection.name || "Unnamed"}
                  </a>
                </td>
                <td
                  class="px-4 py-3 text-right font-mono text-muted-foreground"
                >
                  {collection.influxCount}
                </td>
                <td
                  class="px-4 py-3 text-right font-mono text-muted-foreground"
                >
                  {collection.connectionCount}
                </td>
                <td class="px-4 py-3 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/collections/{collection.id}" variant="ghost" size="icon-sm">
                          <PencilIcon class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
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
          <Button variant="link" href="/collections" class="h-auto p-0 text-sm"
            >View all {collections.length} collections →</Button
          >
        </div>
      {/if}
    {/if}
  </section>

  <!-- Consumers section -->
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Consumers
      </h2>
      <Button size="sm" href="/consumers/new">
        <PlusIcon class="size-4" />
        <span class="hidden sm:inline">Add Consumer</span>
      </Button>
    </div>

    {#if consumers.length === 0}
      <div
        class="rounded-lg border border-dashed border-border p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">No consumers configured</p>
        <Button variant="link" href="/consumers/new" class="mt-2"
          >Add your first consumer →</Button
        >
      </div>
    {:else}
      <div class="overflow-hidden rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th
                class="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >Name</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
                >Connections</th
              >
              <th
                class="px-4 py-2.5 text-right font-medium text-muted-foreground"
              ></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each consumers.slice(0, 5) as consumer}
              <tr class="hover:bg-muted/30">
                <td class="px-4 py-3">
                  <a
                    href="/consumers/{consumer.id}"
                    class="font-medium hover:underline"
                  >
                    {consumer.name || "Unnamed"}
                  </a>
                </td>
                <td
                  class="px-4 py-3 text-right font-mono text-muted-foreground"
                >
                  {consumer.connectionCount}
                </td>
                <td class="px-4 py-3 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button href="/consumers/{consumer.id}" variant="ghost" size="icon-sm">
                          <PencilIcon class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
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
          <Button variant="link" href="/consumers" class="h-auto p-0 text-sm"
            >View all {consumers.length} consumers →</Button
          >
        </div>
      {/if}
    {/if}
  </section>
</div>
