<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getCollections } from "$lib/remote/collections.remote";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import { ConnectionType, type ServiceCollection } from "@contfu/svc-core";
  import { BoxesIcon, FoldersIcon, PlusIcon, ShapesIcon } from "@lucide/svelte";

  const collections = $derived(await getCollections());
  const quota = $derived(await getQuotaUsage());

  const atCollectionLimit = $derived(
    quota !== null && quota.maxCollections !== -1 && quota.collections >= quota.maxCollections,
  );

  const groupedCollections = $derived.by(() => {
    const order: (string | null)[] = [];
    const groups = new Map<
      string | null,
      { ct: number | null; name: string; items: ServiceCollection[] }
    >();
    for (const c of collections) {
      const key = c.connectionId ?? null;
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, {
          ct: c.connectionType,
          name: c.connectionName ?? "standalone",
          items: [],
        });
      }
      groups.get(key)!.items.push(c);
    }
    // standalone first, rest in insertion order
    return [null, ...order.filter((k) => k !== null)]
      .filter((k) => groups.has(k))
      .map((k) => ({ key: k, ...groups.get(k)! }));
  });
</script>

<SiteHeader icon={FoldersIcon} title="collections">
  <div class="ml-auto flex items-center gap-2">
    {#if atCollectionLimit}
      <Button size="sm" disabled>
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add</span>
      </Button>
    {:else}
      <Button href="/collections/new" size="sm">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add</span>
      </Button>
    {/if}
  </div>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu collections list
  </p>

  {#if atCollectionLimit}
    <p class="mb-4 text-xs text-muted-foreground">
      Collection limit reached ({quota?.collections}/{quota?.maxCollections}).
      <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more.
    </p>
  {/if}

  {#if collections.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no collections yet</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Create a collection to aggregate content from multiple sources.
      </p>
      <div class="mt-4 flex items-center justify-center gap-2">
        {#if !atCollectionLimit}
          <Button href="/collections/new">
            create collection
          </Button>
        {/if}
      </div>
    </div>
  {:else}
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">inflows</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">outflows</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each groupedCollections as group}
            <tr class="border-b border-border bg-muted/30">
              <td colspan="3" class="px-3 py-1.5">
                {#if group.key !== null}
                  <a
                    href="/connections/{group.key}"
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    <ConnectionIcon type={group.ct} class="h-3 w-3" />
                    {group.name}
                  </a>
                {:else}
                  <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ShapesIcon class="h-3 w-3" />
                    {group.name}
                  </span>
                {/if}
              </td>
            </tr>
            {#each group.items as collection}
              <tr class="hover:bg-muted/30 transition-colors duration-100">
                <td class="px-3 py-2 pl-6">
                  <a href="/collections/{collection.id}" class="flex items-center gap-1.5 hover:text-primary transition-colors duration-150">
                    {#if collection.icon?.type === "emoji"}
                      <span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">{collection.icon.value}</span>
                    {:else if collection.icon?.type === "image"}
                      <img src={collection.icon.url} alt="" class="h-4 w-4 shrink-0 object-contain" />
                    {:else}
                      <BoxesIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                    {/if}
                    {collection.displayName}
                    <span class="ml-1 text-muted-foreground">{collection.name}</span>
                  </a>
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {collection.flowSourceCount}
                </td>
                <td class="px-3 py-2 text-right text-muted-foreground">
                  {collection.flowTargetCount}
                </td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
