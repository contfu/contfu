<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    createIntegration,
    deleteIntegration,
    listIntegrations,
    renameIntegration,
  } from "$lib/remote/integrations.remote";
  import { CheckIcon, PencilIcon, PlugIcon, PlusIcon, TrashIcon, XIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const integrations = $derived(await listIntegrations());

  let connectingNotion = $state(false);

  // Inline rename state
  let editingId = $state<string | null>(null);
  let editingLabel = $state("");

  // Manual creation form state
  let showAddForm = $state(false);
  let newLabel = $state("");
  let newToken = $state("");
  let addPending = $state(false);

  async function handleConnectNotion() {
    connectingNotion = true;
    try {
      await authClient.linkSocial({
        provider: "notion",
        callbackURL: "/integrations",
      });
    } catch {
      toast.error("Failed to connect Notion");
    } finally {
      connectingNotion = false;
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remove "${label}"? Sources using it will lose their credentials link.`))
      return;
    try {
      await deleteIntegration({ id });
      toast.success("Integration removed");
    } catch {
      toast.error("Failed to remove integration");
    }
  }

  function startRename(id: string, label: string) {
    editingId = id;
    editingLabel = label;
  }

  function cancelRename() {
    editingId = null;
    editingLabel = "";
  }

  async function saveRename(id: string) {
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    try {
      await renameIntegration({ id, label: trimmed });
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
    } finally {
      editingId = null;
      editingLabel = "";
    }
  }

  async function handleAddManual() {
    const label = newLabel.trim();
    const token = newToken.trim();
    if (!label || !token) return;
    addPending = true;
    try {
      await createIntegration({ providerId: "notion", label, token });
      toast.success("Integration added");
      newLabel = "";
      newToken = "";
      showAddForm = false;
    } catch {
      toast.error("Failed to add integration");
    } finally {
      addPending = false;
    }
  }
</script>

<SiteHeader icon={PlugIcon} title="integrations">
  <div class="ml-auto flex items-center gap-2">
    <Button variant="outline" onclick={() => (showAddForm = !showAddForm)}>
      <PlusIcon class="size-3" />
      <span class="hidden sm:inline">add token</span>
    </Button>
    <Button onclick={handleConnectNotion} disabled={connectingNotion}>
      <PlusIcon class="size-3" />
      <span class="hidden sm:inline">{connectingNotion ? "connecting..." : "connect Notion"}</span>
    </Button>
  </div>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu integrations list
  </p>

  {#if showAddForm}
    <form
      class="mb-6 space-y-3 border border-border bg-muted/50 p-4"
      onsubmit={(e) => {
        e.preventDefault();
        void handleAddManual();
      }}
    >
      <div class="space-y-1.5">
        <Label>Name</Label>
        <Input bind:value={newLabel} placeholder="My Notion workspace" required />
      </div>
      <div class="space-y-1.5">
        <Label>Notion API Token</Label>
        <Input bind:value={newToken} type="password" placeholder="secret_..." required />
        <p class="text-xs text-muted-foreground">
          Get your token at <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener"
            class="underline">notion.so/my-integrations</a
          >
        </p>
      </div>
      <div class="flex gap-2">
        <Button type="submit" size="sm" disabled={addPending}>
          {addPending ? "Adding..." : "Add Integration"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onclick={() => (showAddForm = false)}>
          Cancel
        </Button>
      </div>
    </form>
  {/if}

  {#if !integrations || integrations.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no integrations configured</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Connect a Notion workspace or add an API token to get started.
      </p>
    </div>
  {:else}
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">provider</th>
            <th class="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">account</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">status</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each integrations as integration (integration.id)}
            <tr class="hover:bg-muted/30 transition-colors duration-100">
              <td class="px-3 py-2">
                {#if editingId === integration.id}
                  <form
                    class="flex items-center gap-1"
                    onsubmit={(e) => {
                      e.preventDefault();
                      void saveRename(integration.id);
                    }}
                  >
                    <Input
                      bind:value={editingLabel}
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
                  <span>{integration.label}</span>
                  <div class="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </div>
                {/if}
              </td>
              <td class="px-3 py-2 text-muted-foreground">
                {integration.providerId}
              </td>
              <td class="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                {integration.accountId ? integration.accountId.slice(0, 8) : "--"}
              </td>
              <td class="px-3 py-2">
                {#if integration.hasCredentials}
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
                {#if editingId !== integration.id}
                  <div class="flex items-center justify-end gap-1">
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon-sm"
                              onclick={() => startRename(integration.id, integration.label)}
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
                              onclick={() => handleDelete(integration.id, integration.label)}
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
