<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Tabs from "$lib/components/ui/tabs";
  import { createClientConnection, createConnection } from "$lib/remote/connections.remote";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import { ConnectionType } from "@contfu/core";
  import { toast } from "svelte-sonner";

  const quota = $derived(await getQuotaUsage());
  const atConnectionLimit = $derived(quota !== null && quota.maxConnections !== -1 && quota.connections >= quota.maxConnections);

  let activeTab = $state("service");
  let newName = $state("");
  let newToken = $state("");
  let newProviderId = $state("notion");
  let addPending = $state(false);
  let connectingNotion = $state(false);

  async function handleConnectNotion() {
    connectingNotion = true;
    try {
      await authClient.linkSocial({
        provider: "notion",
        callbackURL: "/connections",
      });
    } catch {
      toast.error("Failed to connect Notion");
      connectingNotion = false;
    }
  }

  async function handleAddService() {
    const name = newName.trim();
    const token = newToken.trim();
    if (!name || !token) return;
    addPending = true;
    try {
      const providerTypeMap: Record<string, ConnectionType> = {
        notion: ConnectionType.NOTION,
        strapi: ConnectionType.STRAPI,
        contentful: ConnectionType.CONTENTFUL,
        web: ConnectionType.WEB,
      };
      const result = await createConnection({ type: providerTypeMap[newProviderId] ?? ConnectionType.NOTION, name, token });
      toast.success("Connection added");
      goto(`/connections/${result.id}`);
    } catch {
      toast.error("Failed to add connection");
      addPending = false;
    }
  }

  async function handleAddClient() {
    const name = newName.trim();
    if (!name) return;
    addPending = true;
    try {
      const result = await createClientConnection({ name });
      toast.success("Client connection created");
      goto(`/connections/${result.id}`);
    } catch {
      toast.error("Failed to create client");
      addPending = false;
    }
  }

  const hasOAuth = $derived(newProviderId === "notion");
</script>

<SiteHeader title="new connection">
  <a href="/connections" class="ml-auto text-xs text-muted-foreground hover:text-foreground">
    &lt; connections
  </a>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu connections add
  </p>

  {#if atConnectionLimit}
    <p class="mb-6 text-sm text-muted-foreground">
      Connection limit reached ({quota?.connections}/{quota?.maxConnections}).
      <a href="/billing" class="underline hover:text-foreground">Upgrade your plan</a> to add more connections.
    </p>
  {/if}

  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="mb-6">
      <Tabs.Trigger value="service">service</Tabs.Trigger>
      <Tabs.Trigger value="client">client</Tabs.Trigger>
    </Tabs.List>

    <!-- Service tab -->
    <Tabs.Content value="service">
      <div class="mb-6 max-w-sm space-y-1.5">
        <Label>Provider</Label>
        <select
          bind:value={newProviderId}
          class="w-full border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="notion">Notion</option>
          <option value="strapi">Strapi</option>
          <option value="contentful">Contentful</option>
          <option value="web">Web</option>
        </select>
      </div>

      {#if hasOAuth}
        <!-- Two-option layout: forms start at top, "or" divider is centered vertically -->
        <div class="flex flex-col sm:flex-row sm:items-stretch">
          <!-- OAuth option -->
          <div class="flex flex-1 flex-col gap-4 pb-6 sm:pb-0 sm:pr-12">
            <div>
              <p class="mb-1 text-sm font-medium">OAuth</p>
              <p class="text-xs text-muted-foreground">Sign in with your {newProviderId} account. Contfu will request access automatically.</p>
            </div>
            <Button onclick={handleConnectNotion} disabled={connectingNotion || atConnectionLimit} class="w-fit">
              {connectingNotion ? "connecting..." : `connect ${newProviderId}`}
            </Button>
          </div>

          <!-- Divider — "or" is centered, lines fill remaining space -->
          <div class="flex items-center sm:flex-col sm:px-8">
            <div class="h-px flex-1 bg-border sm:h-auto sm:w-px sm:flex-1"></div>
            <span class="shrink-0 px-4 py-2 text-xs text-muted-foreground sm:px-0 sm:py-4">or</span>
            <div class="h-px flex-1 bg-border sm:h-auto sm:w-px sm:flex-1"></div>
          </div>

          <!-- API token option -->
          <form
            class="flex flex-1 flex-col gap-4 pt-6 sm:pl-12 sm:pt-0"
            onsubmit={(e) => {
              e.preventDefault();
              void handleAddService();
            }}
          >
            <div>
              <p class="mb-1 text-sm font-medium">API Token</p>
              <p class="text-xs text-muted-foreground">Use an internal integration token from your {newProviderId} workspace.</p>
            </div>
            <div class="space-y-3">
              <div class="space-y-1.5">
                <Label>Name</Label>
                <Input bind:value={newName} placeholder="My workspace" required />
              </div>
              <div class="space-y-1.5">
                <Label>Token</Label>
                <Input bind:value={newToken} type="password" placeholder="secret_..." required />
              </div>
              <Button type="submit" size="sm" disabled={addPending || atConnectionLimit}>
                {addPending ? "adding..." : "add connection"}
              </Button>
            </div>
          </form>
        </div>
      {:else}
        <!-- Non-OAuth providers -->
        <form
          class="max-w-sm space-y-4"
          onsubmit={(e) => {
            e.preventDefault();
            void handleAddService();
          }}
        >
          <div class="space-y-1.5">
            <Label>Name</Label>
            <Input bind:value={newName} placeholder="My workspace" required />
          </div>
          <div class="space-y-1.5">
            <Label>API Token</Label>
            <Input bind:value={newToken} type="password" placeholder="..." required />
          </div>
          <Button type="submit" size="sm" disabled={addPending}>
            {addPending ? "adding..." : "add connection"}
          </Button>
        </form>
      {/if}
    </Tabs.Content>

    <!-- Client tab -->
    <Tabs.Content value="client">
      <form
        class="max-w-sm space-y-4"
        onsubmit={(e) => {
          e.preventDefault();
          void handleAddClient();
        }}
      >
        <p class="text-xs text-muted-foreground">
          An API key will be generated automatically for this client.
        </p>
        <div class="space-y-1.5">
          <Label>Name</Label>
          <Input bind:value={newName} placeholder="My App" required />
        </div>
        <Button type="submit" size="sm" disabled={addPending}>
          {addPending ? "creating..." : "create client"}
        </Button>
      </form>
    </Tabs.Content>
  </Tabs.Root>
</div>
