<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    getSource,
    updateSource,
    deleteSource,
    testConnection,
    regenerateWebhookSecret,
  } from "$lib/remote/sources.remote";
  import { getCollectionsBySource } from "$lib/remote/collections.remote";
  import { getWebhookLogs, type WebhookLogEntry } from "$lib/remote/webhookLogs.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
    2: "Web",
  };

  const AUTH_TYPE_LABELS: Record<number, string> = {
    0: "None",
    1: "Bearer Token",
    2: "Basic Auth",
  };

  function getWebAuthType(credentials: Buffer | null): number {
    if (!credentials || credentials.length === 0) return 0;
    return credentials[0];
  }

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
  const collections = source ? await getCollectionsBySource({ sourceId: id }) : [];

  // Load webhook logs for Strapi sources
  const initialWebhookLogs: WebhookLogEntry[] =
    source?.type === 1 ? await getWebhookLogs({ sourceId: id, limit: 10 }) : [];

  if (!source) {
    goto("/sources");
  }

  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);
  let updateSuccess = $state(false);
  let webhookLogs = $state(initialWebhookLogs);
  let webhookSecret = $state<string | null>(null);
  let regeneratingSecret = $state(false);

  // Generate webhook URL
  const webhookUrl = source
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/webhooks/strapi/${source.id}`
    : "";

  async function handleTestConnection() {
    if (!source) return;
    testPending = true;
    testResult = null;

    try {
      const result = await testConnection({ id: source.id });
      testResult = result;
    } catch (error) {
      testResult = {
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      };
    } finally {
      testPending = false;
    }
  }

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => { updateSuccess = false; }, 3000);
  }

  async function handleRegenerateSecret() {
    if (!source) return;
    if (!confirm("Regenerate webhook secret? You'll need to update it in Strapi.")) return;

    regeneratingSecret = true;
    try {
      const result = await regenerateWebhookSecret({ id: source.id });
      if (result.success && result.secret) {
        webhookSecret = result.secret;
      }
    } catch (error) {
      console.error("Failed to regenerate secret:", error);
    } finally {
      regeneratingSecret = false;
    }
  }

  async function refreshLogs() {
    if (!source || source.type !== 1) return;
    webhookLogs = await getWebhookLogs({ sourceId: source.id, limit: 10 });
  }

  function formatTimestamp(date: Date): string {
    return new Date(date).toLocaleString();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "unauthorized":
        return "text-orange-600";
      default:
        return "text-muted-foreground";
    }
  }
</script>

{#if source}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <a href="/sources" class="text-sm text-muted-foreground hover:text-foreground">← Sources</a>
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">{source.name || "Unnamed Source"}</h1>
        <span class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
        </span>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">Configure your content source</p>
    </div>

    <!-- Edit form -->
    <section class="mb-8">
      <form method="post" action={updateSource.action} class="space-y-4" onsubmit={() => {
        if (updateSource.result?.success) handleUpdateSuccess();
      }}>
        <input type="hidden" name="id" value={source.id} />

        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" name="name" type="text" placeholder="My Content Source" value={source.name ?? ""} />
          {#if updateSource.fields?.name?.issues()?.length}
            <p class="text-sm text-destructive">{updateSource.fields?.name?.issues()?.[0]?.message}</p>
          {/if}
        </div>

        {#if source.type === 1 || source.type === 2}
          <div class="space-y-1.5">
            <Label for="url">{source.type === 1 ? "Strapi URL" : "Base URL"}</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder={source.type === 1 ? "https://strapi.example.com" : "https://example.com"}
              value={source.url ?? ""}
            />
            {#if updateSource.fields?.url?.issues()?.length}
              <p class="text-sm text-destructive">{updateSource.fields?.url?.issues()?.[0]?.message}</p>
            {/if}
          </div>
        {/if}

        {#if source.type === 2}
          {@const authType = getWebAuthType(source.credentials)}
          <div class="space-y-1.5">
            <Label>Authentication</Label>
            <div class="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              {AUTH_TYPE_LABELS[authType] ?? "Unknown"}
            </div>
            <p class="text-xs text-muted-foreground">Create a new source to change auth method.</p>
          </div>
        {/if}

        {#if source.type !== 2 || getWebAuthType(source.credentials) !== 0}
          {@const isWebWithAuth = source.type === 2 && getWebAuthType(source.credentials) !== 0}
          {@const webAuthType = source.type === 2 ? getWebAuthType(source.credentials) : null}
          <div class="space-y-1.5">
            <Label for="_credentials">
              {#if isWebWithAuth}
                {webAuthType === 1 ? "Bearer Token" : "Credentials"}
              {:else}
                API Token
              {/if}
            </Label>
            <Input
              id="_credentials"
              name="_credentials"
              type="password"
              placeholder="Leave blank to keep current"
            />
            {#if updateSource.fields?._credentials?.issues()?.length}
              <p class="text-sm text-destructive">{updateSource.fields?._credentials?.issues()?.[0]?.message}</p>
            {/if}
          </div>
        {/if}

        <!-- Info block -->
        <div class="rounded-md border border-border bg-muted/30 p-4">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Collections</dt>
            <dd class="text-right font-mono">{source.collectionCount}</dd>
            <dt class="text-muted-foreground">Created</dt>
            <dd class="text-right">{new Date(source.createdAt * 1000).toLocaleDateString()}</dd>
            {#if source.updatedAt}
              <dt class="text-muted-foreground">Updated</dt>
              <dd class="text-right">{new Date(source.updatedAt * 1000).toLocaleDateString()}</dd>
            {/if}
          </dl>
        </div>

        {#if testResult}
          <Alert.Root variant={testResult.success ? "default" : "destructive"}>
            <Alert.Title>{testResult.success ? "Connection successful" : "Connection failed"}</Alert.Title>
            <Alert.Description>{testResult.message}</Alert.Description>
          </Alert.Root>
        {/if}

        {#if updateSuccess}
          <Alert.Root>
            <Alert.Title>Changes saved</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex gap-2">
          <Button type="submit" disabled={!!updateSource.pending}>
            {updateSource.pending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onclick={handleTestConnection} disabled={testPending}>
            {testPending ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </form>
    </section>

    <!-- Webhook configuration (Strapi only) -->
    {#if source.type === 1}
      <section class="mb-8">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Webhook Configuration</h2>
        <div class="rounded-lg border border-border p-4 space-y-4">
          <div class="space-y-1.5">
            <Label>Webhook URL</Label>
            <div class="flex gap-2">
              <Input type="text" value={webhookUrl} readonly class="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => navigator.clipboard.writeText(webhookUrl)}
              >
                Copy
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">Add this URL to your Strapi webhook configuration.</p>
          </div>

          <div class="space-y-1.5">
            <Label>Webhook Secret</Label>
            {#if webhookSecret}
              <div class="rounded-md border border-green-500/30 bg-green-50 dark:bg-green-950/30 p-3">
                <p class="text-xs font-medium text-green-700 dark:text-green-400 mb-1">New secret generated! Copy it now — it won't be shown again.</p>
                <code class="block text-xs font-mono break-all">{webhookSecret}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  onclick={() => navigator.clipboard.writeText(webhookSecret ?? "")}
                >
                  Copy Secret
                </Button>
              </div>
            {:else}
              <div class="flex gap-2 items-center">
                <Input type="password" value="••••••••••••••••" readonly class="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onclick={handleRegenerateSecret}
                  disabled={regeneratingSecret}
                >
                  {regeneratingSecret ? "..." : "Regenerate"}
                </Button>
              </div>
            {/if}
            <p class="text-xs text-muted-foreground">
              Add this secret as the "Authorization" header or use HMAC signing in Strapi.
            </p>
          </div>
        </div>
      </section>

      <!-- Webhook Activity Log -->
      <section class="mb-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Webhook Activity</h2>
          <Button size="sm" variant="ghost" onclick={refreshLogs}>Refresh</Button>
        </div>

        {#if webhookLogs.length === 0}
          <div class="rounded-lg border border-dashed border-border p-8 text-center">
            <p class="text-sm text-muted-foreground">No webhook activity yet</p>
            <p class="text-xs text-muted-foreground mt-1">Events will appear here when Strapi sends webhooks.</p>
          </div>
        {:else}
          <div class="overflow-hidden rounded-lg border border-border">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/50">
                  <th class="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                  <th class="px-3 py-2 text-left font-medium text-muted-foreground">Event</th>
                  <th class="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
                  <th class="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                  <th class="px-3 py-2 text-right font-medium text-muted-foreground">Broadcast</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                {#each webhookLogs as log}
                  <tr class="hover:bg-muted/30">
                    <td class="px-3 py-2 text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td class="px-3 py-2 font-mono text-xs">{log.event}</td>
                    <td class="px-3 py-2 text-xs">{log.model || "-"}</td>
                    <td class="px-3 py-2 text-center">
                      <span class="text-xs font-medium {getStatusColor(log.status)}">
                        {log.status}
                      </span>
                      {#if log.errorMessage}
                        <p class="text-xs text-muted-foreground truncate max-w-[150px]" title={log.errorMessage}>
                          {log.errorMessage}
                        </p>
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right font-mono text-xs">
                      {log.itemsBroadcast}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Collections section -->
    <section class="mb-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Collections</h2>
        <Button size="sm" href="/sources/{id}/collections/new">Add Collection</Button>
      </div>

      {#if collections.length === 0}
        <div class="rounded-lg border border-dashed border-border p-8 text-center">
          <p class="text-sm text-muted-foreground">No collections configured</p>
          <Button variant="link" href="/sources/{id}/collections/new" class="mt-2">Add your first collection →</Button>
        </div>
      {:else}
        <div class="overflow-hidden rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/50">
                <th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th class="px-4 py-2.5 text-right font-medium text-muted-foreground">Clients</th>
                <th class="px-4 py-2.5 text-right font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {#each collections as collection}
                <tr class="hover:bg-muted/30">
                  <td class="px-4 py-3">
                    <a href="/sources/{id}/collections/{collection.id}" class="font-medium hover:underline">
                      {collection.name || "Unnamed"}
                    </a>
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-muted-foreground">
                    {collection.connectionCount}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a href="/sources/{id}/collections/{collection.id}" class="text-primary hover:underline">Edit</a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete source</h3>
          <p class="text-sm text-muted-foreground">This will delete all collections.</p>
        </div>
        <form method="post" action={deleteSource.action}>
          <input type="hidden" name="id" value={source.id} />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            onclick={(e: MouseEvent) => {
              if (!confirm(`Delete "${source.name || "this source"}"? This cannot be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            Delete
          </Button>
        </form>
      </div>
    </section>
  </div>
{:else}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
    </Alert.Root>
    <Button href="/sources" class="mt-4">Back to Sources</Button>
  </div>
{/if}
