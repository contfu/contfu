<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { authClient } from "$lib/auth-client";
  import { KeyIcon, CopyIcon, TrashIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  let keys = $state<any[]>([]);
  let newKeyName = $state("");
  let newKeyScope = $state<"full" | "read-only">("full");
  let createdKey = $state<string | null>(null);
  let showCreateDialog = $state(false);
  let copied = $state(false);

  function scopeLabel(key: any): string {
    const perms = key.permissions?.api;
    if (Array.isArray(perms) && perms.includes("write")) return "Full access";
    return "Read-only";
  }

  async function loadKeys() {
    const res = await authClient.apiKey.list();
    keys = res.data ?? [];
  }

  async function createKey() {
    const permissions = newKeyScope === "full"
      ? { api: ["read", "write"] }
      : { api: ["read"] };
    const res = await authClient.apiKey.create({
      name: newKeyName || "Unnamed key",
      permissions,
    });
    if (res.data?.key) {
      createdKey = res.data.key;
      newKeyName = "";
      newKeyScope = "full";
      await loadKeys();
    }
  }

  async function deleteKey(keyId: string) {
    await authClient.apiKey.delete({ keyId });
    await loadKeys();
  }

  async function copyKey() {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  onMount(loadKeys);
</script>

<svelte:head>
  <title>API Keys - Contfu Admin</title>
</svelte:head>

<SiteHeader icon={KeyIcon} title="API Keys">
  <div class="ml-auto">
    <Button onclick={() => (showCreateDialog = true)}>Create API Key</Button>
  </div>
</SiteHeader>

<div class="p-6">
  <p class="mb-6 text-sm text-muted-foreground">
    Manage API keys for CLI and programmatic access.
  </p>

  <div class="rounded-md border">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b bg-muted/50">
          <th class="p-3 text-left font-medium">Name</th>
          <th class="p-3 text-left font-medium">Key</th>
          <th class="p-3 text-left font-medium">Scope</th>
          <th class="p-3 text-left font-medium">Created</th>
          <th class="p-3 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each keys as key}
          <tr class="border-b last:border-b-0">
            <td class="p-3">{key.name ?? "Unnamed"}</td>
            <td class="p-3 font-mono text-muted-foreground">{key.start ?? ""}···</td>
            <td class="p-3 text-muted-foreground">{scopeLabel(key)}</td>
            <td class="p-3 text-muted-foreground">{new Date(key.createdAt).toLocaleDateString()}</td>
            <td class="p-3 text-right">
              <Button variant="ghost" size="icon" onclick={() => deleteKey(key.id)}>
                <TrashIcon class="size-4" />
              </Button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="p-6 text-center text-muted-foreground">No API keys yet</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create API Key</Dialog.Title>
      <Dialog.Description>Give your key a name to identify it later.</Dialog.Description>
    </Dialog.Header>
    {#if createdKey}
      <div class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Copy this key now — it won't be shown again.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 rounded bg-muted p-2 text-sm break-all">{createdKey}</code>
          <Button variant="outline" size="icon" onclick={copyKey}>
            <CopyIcon class="size-4" />
          </Button>
        </div>
        {#if copied}
          <p class="text-sm text-green-600">Copied!</p>
        {/if}
      </div>
      <Dialog.Footer>
        <Button onclick={() => { createdKey = null; showCreateDialog = false; }}>Done</Button>
      </Dialog.Footer>
    {:else}
      <div class="space-y-3">
        <input
          type="text"
          placeholder="Key name (e.g. CI/CD)"
          bind:value={newKeyName}
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div class="space-y-1.5">
          <label class="text-sm font-medium">Permissions</label>
          <select
            bind:value={newKeyScope}
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="full">Full access (read & write)</option>
            <option value="read-only">Read-only</option>
          </select>
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (showCreateDialog = false)}>Cancel</Button>
        <Button onclick={createKey}>Create</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
