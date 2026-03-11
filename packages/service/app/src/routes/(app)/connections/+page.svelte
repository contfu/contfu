<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    deleteConnection,
    listConnections,
    renameConnection,
  } from "$lib/remote/connections.remote";
  import { ConnectionType } from "@contfu/core";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import { ConnectionTypeMeta } from "@contfu/svc-core";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import { CheckIcon, PencilIcon, PlugIcon, PlusIcon, TrashIcon, XIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const connections = $derived(await listConnections());
  const quota = $derived(await getQuotaUsage());

  const atConnectionLimit = $derived(
    quota !== null && quota.maxConnections !== -1 && quota.connections >= quota.maxConnections,
  );

  // Inline rename state
  let editingId = $state<string | null>(null);
  let editingName = $state("");

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}"? All collections and flows using it will be deleted.`))
      return;
    try {
      await deleteConnection({ id });
      toast.success("Connection removed");
    } catch {
      toast.error("Failed to remove connection");
    }
  }

  function startRename(id: string, name: string) {
    editingId = id;
    editingName = name;
  }

  function cancelRename() {
    editingId = null;
    editingName = "";
  }

  async function saveRename(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      await renameConnection({ id, name: trimmed });
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
    } finally {
      editingId = null;
      editingName = "";
    }
  }


</script>

<SiteHeader icon={PlugIcon} title="connections">
  <div class="ml-auto flex items-center gap-2">
    {#if atConnectionLimit}
      <Button disabled>
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add connection</span>
      </Button>
    {:else}
      <Button href="/connections/new">
        <PlusIcon class="size-3" />
        <span class="hidden sm:inline">add connection</span>
      </Button>
    {/if}
  </div>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu connections list
  </p>

  {#if atConnectionLimit}
    <p class="mb-4 text-xs text-muted-foreground">
      Connection limit reached ({quota?.connections}/{quota?.maxConnections}).
      <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more.
    </p>
  {/if}

  {#if !connections || connections.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no connections configured</p>
      {#if !atConnectionLimit}
        <Button variant="link" class="mt-2 text-xs" href="/connections/new">add connection</Button>
      {/if}
    </div>
  {:else}
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">type</th>
            <th class="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">collections</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">status</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each connections as connection (connection.id)}
            <tr class="hover:bg-muted/30 transition-colors duration-100">
              <td class="px-3 py-2">
                {#if editingId === connection.id}
                  <form
                    class="flex items-center gap-1"
                    onsubmit={(e) => {
                      e.preventDefault();
                      void saveRename(connection.id);
                    }}
                  >
                    <Input
                      bind:value={editingName}
                      class="h-6 text-xs"
                      autofocus
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === "Escape") cancelRename();
                      }}
                    />
                    <Button type="submit" variant="ghost" size="icon-sm">
                      <CheckIcon class="size-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onclick={cancelRename}>
                      <XIcon class="size-3" />
                    </Button>
                  </form>
                {:else}
                  <a href="/connections/{connection.id}" class="hover:text-primary transition-colors duration-150">
                    {connection.name}
                  </a>
                  <div class="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(connection.createdAt).toLocaleDateString()}
                  </div>
                {/if}
              </td>
              <td class="px-3 py-2 text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <ConnectionIcon type={connection.type} class="size-3" />
                  {ConnectionTypeMeta[connection.type]?.label ?? connection.type}
                </span>
              </td>
              <td class="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                {connection.collectionCount}
              </td>
              <td class="px-3 py-2">
                {#if connection.type === ConnectionType.CLIENT}
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
              </td>
              <td class="px-3 py-2 text-right">
                {#if editingId !== connection.id}
                  <div class="flex items-center justify-end gap-1">
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon-sm"
                              onclick={() => startRename(connection.id, connection.name)}
                            >
                              <PencilIcon class="size-3" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>rename</Tooltip.Content>
                      </Tooltip.Root>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon-sm"
                              class="text-destructive hover:text-destructive"
                              onclick={() => handleDelete(connection.id, connection.name)}
                            >
                              <TrashIcon class="size-3" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>delete</Tooltip.Content>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
