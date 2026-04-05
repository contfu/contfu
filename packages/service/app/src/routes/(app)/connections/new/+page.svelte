<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Tabs from "$lib/components/ui/tabs";
  import { createAppConnection, createConnection } from "$lib/remote/connections.remote";
  import { getQuotaUsage } from "$lib/remote/billing.remote";
  import { ConnectionType } from "@contfu/core";
  import { toast } from "svelte-sonner";
  import { untrack } from "svelte";

  const validProviders = ["notion", "strapi", "contentful", "web"];
  const oauthProviders = new Set(["notion"]);

  const typeParam = page.url.searchParams.get("type");
  const initialProvider = typeParam && validProviders.includes(typeParam) ? typeParam : "notion";
  const initialTab = typeParam === "app" ? "app" : "service";

  const quota = $derived(await getQuotaUsage());
  const atConnectionLimit = $derived(quota !== null && quota.maxConnections !== -1 && quota.connections >= quota.maxConnections);

  let activeTab = $state(initialTab);
  let newName = $state("");
  let newToken = $state("");
  let newProviderId = $state(initialProvider);
  let addPending = $state(false);
  let connectingNotion = $state(false);

  // Auto-start OAuth flow when deep-linked with an OAuth provider type
  $effect(() => {
    if (typeParam && oauthProviders.has(typeParam)) {
      untrack(() => {
        if (!atConnectionLimit) handleConnectNotion();
      });
    }
  });

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

  async function handleAddApp() {
    const name = newName.trim();
    if (!name) return;
    addPending = true;
    try {
      const result = await createAppConnection({ name });
      toast.success("App connection created");
      goto(`/connections/${result.id}`);
    } catch {
      toast.error("Failed to create app");
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
      <Tabs.Trigger value="app">app</Tabs.Trigger>
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
        <div class="max-w-sm space-y-4">
          <p class="text-xs text-muted-foreground">Sign in with your {newProviderId} account. Contfu will request access automatically.</p>
          <Button onclick={handleConnectNotion} disabled={connectingNotion || atConnectionLimit} class="w-fit">
            {connectingNotion ? "connecting..." : `connect ${newProviderId}`}
          </Button>
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

    <!-- App tab -->
    <Tabs.Content value="app">
      <form
        class="max-w-sm space-y-4"
        onsubmit={(e) => {
          e.preventDefault();
          void handleAddApp();
        }}
      >
        <p class="text-xs text-muted-foreground">
          An API key will be generated automatically for this app.
        </p>
        <div class="space-y-1.5">
          <Label>Name</Label>
          <Input bind:value={newName} placeholder="My App" required />
        </div>
        <Button type="submit" size="sm" disabled={addPending}>
          {addPending ? "creating..." : "create app"}
        </Button>
      </form>
    </Tabs.Content>
  </Tabs.Root>
</div>
