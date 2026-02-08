<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import {
    createSourceCollection,
    getSourceCollectionsBySource,
  } from "$lib/remote/source-collections.remote";
  import {
    deleteSource,
    getSource,
    regenerateWebhookSecret,
    testConnection,
    updateSource,
  } from "$lib/remote/sources.remote";
  import {
    getWebhookLogs,
    type WebhookLogEntry,
  } from "$lib/remote/webhookLogs.remote";
  import { cn } from "$lib/utils";
  import { SourceType } from "@contfu/svc-backend/features/sources/testSourceConnection";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";

  const nameId = useId();
  const urlId = useId();
  const credentialsId = useId();
  const webPathId = useId();
  const collectionNameId = useId();

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    [SourceType.NOTION]: "Notion",
    [SourceType.STRAPI]: "Strapi",
    [SourceType.WEB]: "Web",
  };

  const AUTH_TYPE_LABELS: Record<number, string> = {
    0: "None",
    1: "Bearer Token",
    2: "Basic Auth",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
  const collections = source
    ? await getSourceCollectionsBySource({ sourceId: id })
    : [];

  // Load webhook logs for Strapi sources
  const initialWebhookLogs: WebhookLogEntry[] =
    source?.type === 1 ? await getWebhookLogs({ sourceId: id, limit: 10 }) : [];

  if (!source) {
    goto("/sources");
  }

  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);
  let updateSuccess = $state(false);
  let namePopoverOpen = $state(false);
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
    namePopoverOpen = false;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }

  $effect(() => {
    if (updateSource.result?.success) handleUpdateSuccess();
  });

  async function handleRegenerateSecret() {
    if (!source) return;
    if (
      !confirm("Regenerate webhook secret? You'll need to update it in Strapi.")
    )
      return;

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
      <a
        href="/sources"
        class="text-sm text-muted-foreground hover:text-foreground">← Sources</a
      >
    </div>

    <div class="mb-8">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {source.name || "Unnamed Source"}
        </h1>
        <Popover.Root bind:open={namePopoverOpen}>
          <Popover.Trigger
            class={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Pencil class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="w-72" align="start">
              <form {...updateSource} class="space-y-3">
                <input
                  {...updateSource.fields?.id.as("number")}
                  type="hidden"
                  value={source.id}
                />
                <div class="space-y-1.5">
                  <Label for={nameId}>Name</Label>
                  <Input
                    id={nameId}
                    {...updateSource.fields?.name.as("text")}
                    value={source.name ?? ""}
                    placeholder="My Content Source"
                    required
                  />
                </div>
                <div class="flex justify-end gap-2">
                  <Popover.Close>
                    <Button type="button" variant="outline" size="sm"
                      >Cancel</Button
                    >
                  </Popover.Close>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!!updateSource.pending}
                  >
                    {updateSource.pending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <span
          class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
        </span>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        {source.collectionCount} collection{source.collectionCount === 1
          ? ""
          : "s"} · Created {new Date(
          source.createdAt,
        ).toLocaleDateString()}
      </p>
    </div>

    {#if updateSuccess}
      <Alert.Root class="mb-6">
        <Alert.Description>Source updated successfully.</Alert.Description>
      </Alert.Root>
    {/if}

    <!-- Settings form -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Connection
      </h2>
      <form {...updateSource} class="space-y-4">
        <input
          {...updateSource.fields?.id.as("number")}
          type="hidden"
          value={source.id}
        />

        {#if source.type === SourceType.STRAPI || source.type === SourceType.WEB}
          <div class="space-y-1.5">
            <Label for={urlId}
              >{source.type === SourceType.STRAPI
                ? "Strapi URL"
                : "Base URL"}</Label
            >
            <Input
              id={urlId}
              {...updateSource.fields?.url.as("url")}
              placeholder={source.type === SourceType.STRAPI
                ? "https://strapi.example.com"
                : "https://example.com"}
              value={source.url ?? ""}
            />
            {#if updateSource.fields?.url?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateSource.fields?.url?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>
        {/if}

        {#if source.type === SourceType.WEB}
          <div class="space-y-1.5">
            <Label>Authentication</Label>
            <div
              class="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm"
            >
              {AUTH_TYPE_LABELS[source.webAuthType ?? 0] ?? "Unknown"}
            </div>
            <p class="text-xs text-muted-foreground">
              Create a new source to change auth method.
            </p>
          </div>
        {/if}

        {#if source.type !== 2 || (source.webAuthType ?? 0) !== 0}
          {@const isWebWithAuth =
            source.type === SourceType.WEB && (source.webAuthType ?? 0) !== 0}
          {@const webAuthType =
            source.type === SourceType.WEB ? (source.webAuthType ?? 0) : null}
          <div class="space-y-1.5">
            <Label for={credentialsId}>
              {#if isWebWithAuth}
                {webAuthType === 1 ? "Bearer Token" : "Credentials"}
              {:else}
                API Token
              {/if}
            </Label>
            <Input
              id={credentialsId}
              {...updateSource.fields?._credentials.as("password")}
              placeholder="Leave blank to keep current"
            />
            {#if updateSource.fields?._credentials?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateSource.fields?._credentials?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>
        {/if}

        {#if testResult}
          <Alert.Root variant={testResult.success ? "default" : "destructive"}>
            <Alert.Title
              >{testResult.success
                ? "Connection successful"
                : "Connection failed"}</Alert.Title
            >
            <Alert.Description>{testResult.message}</Alert.Description>
          </Alert.Root>
        {/if}

        <div class="flex gap-2">
          <Button type="submit" disabled={!!updateSource.pending}>
            {updateSource.pending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onclick={handleTestConnection}
            disabled={testPending}
          >
            {testPending ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </form>
    </section>

    <!-- Webhook configuration (Strapi only) -->
    {#if source.type === SourceType.STRAPI}
      <section class="mb-8">
        <h2
          class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Webhook Configuration
        </h2>
        <div class="rounded-lg border border-border p-4 space-y-4">
          <div class="space-y-1.5">
            <Label>Webhook URL</Label>
            <div class="flex gap-2">
              <Input
                type="text"
                value={webhookUrl}
                readonly
                class="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => navigator.clipboard.writeText(webhookUrl)}
              >
                Copy
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Add this URL to your Strapi webhook configuration.
            </p>
          </div>

          <div class="space-y-1.5">
            <Label>Webhook Secret</Label>
            {#if webhookSecret}
              <div
                class="rounded-md border border-green-500/30 bg-green-50 dark:bg-green-950/30 p-3"
              >
                <p
                  class="text-xs font-medium text-green-700 dark:text-green-400 mb-1"
                >
                  New secret generated! Copy it now — it won't be shown again.
                </p>
                <code class="block text-xs font-mono break-all"
                  >{webhookSecret}</code
                >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  onclick={() =>
                    navigator.clipboard.writeText(webhookSecret ?? "")}
                >
                  Copy Secret
                </Button>
              </div>
            {:else}
              <div class="flex gap-2 items-center">
                <Input
                  type="password"
                  value="••••••••••••••••"
                  readonly
                  class="font-mono"
                />
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
              Add this secret as the "Authorization" header or use HMAC signing
              in Strapi.
            </p>
          </div>
        </div>
      </section>

      <!-- Webhook Activity Log -->
      <section class="mb-8">
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-medium uppercase tracking-wide text-muted-foreground"
          >
            Webhook Activity
          </h2>
          <Button size="sm" variant="ghost" onclick={refreshLogs}
            >Refresh</Button
          >
        </div>

        {#if webhookLogs.length === 0}
          <div
            class="rounded-lg border border-dashed border-border p-8 text-center"
          >
            <p class="text-sm text-muted-foreground">No webhook activity yet</p>
            <p class="text-xs text-muted-foreground mt-1">
              Events will appear here when Strapi sends webhooks.
            </p>
          </div>
        {:else}
          <div class="overflow-hidden rounded-lg border border-border">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/50">
                  <th
                    class="px-3 py-2 text-left font-medium text-muted-foreground"
                    >Time</th
                  >
                  <th
                    class="px-3 py-2 text-left font-medium text-muted-foreground"
                    >Event</th
                  >
                  <th
                    class="px-3 py-2 text-left font-medium text-muted-foreground"
                    >Model</th
                  >
                  <th
                    class="px-3 py-2 text-center font-medium text-muted-foreground"
                    >Status</th
                  >
                  <th
                    class="px-3 py-2 text-right font-medium text-muted-foreground"
                    >Broadcast</th
                  >
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
                      <span
                        class="text-xs font-medium {getStatusColor(log.status)}"
                      >
                        {log.status}
                      </span>
                      {#if log.errorMessage}
                        <p
                          class="text-xs text-muted-foreground truncate max-w-[150px]"
                          title={log.errorMessage}
                        >
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

    <!-- Add Source Collection section (Web sources only) -->
    {#if source.type === SourceType.WEB}
      <section class="mb-8">
        <h2
          class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Add Source Collection
        </h2>
        <div class="rounded-lg border border-border p-4">
          <p class="mb-4 text-sm text-muted-foreground">
            Add a custom path or URL to create a new source collection.
          </p>
          <form {...createSourceCollection} class="space-y-4">
            <input
              {...createSourceCollection.fields?.sourceId.as("number")}
              type="hidden"
              value={source.id}
            />

            <div class="space-y-1.5">
              <Label for={webPathId}>Path or URL</Label>
              <Input
                id={webPathId}
                {...createSourceCollection.fields?.ref.as("text")}
                placeholder="/api/posts or full URL"
                required
              />
            </div>

            <div class="space-y-1.5">
              <Label for={collectionNameId}>Collection Name</Label>
              <Input
                id={collectionNameId}
                {...createSourceCollection.fields?.name.as("text")}
                placeholder="e.g. Blog Posts"
                required
              />
              {#if createSourceCollection.fields?.name?.issues()?.length}
                <p class="text-sm text-destructive">
                  {createSourceCollection.fields?.name?.issues()?.[0]?.message}
                </p>
              {/if}
            </div>

            <Button type="submit" disabled={!!createSourceCollection.pending}>
              {createSourceCollection.pending
                ? "Creating..."
                : "Add Source Collection"}
            </Button>
          </form>
        </div>
      </section>
    {/if}

    <!-- Source Collections section -->
    <section class="mb-8">
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Source Collections
        </h2>
        <Button size="sm" variant="outline" href="/sources/{id}/collections"
          >View All</Button
        >
      </div>

      {#if collections.length === 0}
        <div
          class="rounded-lg border border-dashed border-border p-8 text-center"
        >
          <p class="text-sm text-muted-foreground">
            No source collections discovered yet
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Source collections are auto-discovered when syncing.
          </p>
        </div>
      {:else}
        <div class="overflow-hidden rounded-lg border border-border">
          <ul class="divide-y divide-border">
            {#each collections.slice(0, 5) as collection}
              <li class="px-4 py-3 text-sm font-medium">
                {collection.name || "Unnamed"}
              </li>
            {/each}
          </ul>
          {#if collections.length > 5}
            <div class="border-t border-border px-4 py-2 text-center">
              <a
                href="/sources/{id}/collections"
                class="text-sm text-primary hover:underline"
              >
                View all {collections.length} source collections →
              </a>
            </div>
          {/if}
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Use these in your <a
            href="/collections"
            class="text-primary hover:underline">Collections</a
          > to aggregate content.
        </p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete source</h3>
          <p class="text-sm text-muted-foreground">
            This will delete all collections.
          </p>
        </div>
        <form {...deleteSource}>
          <input
            {...deleteSource.fields?.id.as("number")}
            type="hidden"
            value={source.id}
          />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            onclick={(e: MouseEvent) => {
              if (
                !confirm(
                  `Delete "${source.name || "this source"}"? This cannot be undone.`,
                )
              ) {
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
