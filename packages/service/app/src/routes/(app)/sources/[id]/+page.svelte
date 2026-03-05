<script lang="ts">
  import { goto } from "$app/navigation";
  import ChangeNotionTokenDialog from "$lib/components/ChangeNotionTokenDialog.svelte";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import { Switch } from "$lib/components/ui/switch";
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
  import { tcToast } from "$lib/utils/toast";
  import { SourceType } from "@contfu/core";
  import { CredentialsSource } from "@contfu/svc-core";
  import {
    ChevronRightIcon,
    SaveIcon,
    TrashIcon,
    ZapIcon,
  } from "@lucide/svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { toast } from "svelte-sonner";
  import * as v from "valibot";

  const nameId = useId();
  const urlId = useId();
  const credentialsId = useId();
  const webPathId = useId();
  const collectionNameId = useId();
  const includeRefId = useId();

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

  let { params } = $props();

  let id = $derived(params.id);
  const source = $derived(await getSource({ id }));

  // Sync form fields when source changes
  $effect(() => {
    if (source) {
      console.log(source);

      updateSource
        .for("name")
        .fields.set({ ...source, url: source.url ?? undefined });
      updateSource.fields.set({ ...source, url: source.url ?? undefined });
    }
  });

  // Query object - auto-refreshes after form submissions
  const collections = $derived(
    getSourceCollectionsBySource({ sourceId: params.id }),
  );

  // Load webhook logs for Strapi and Notion sources
  const webhookLogsData = $derived(
    source?.type === SourceType.STRAPI ||
    (source?.type === SourceType.NOTION && source.credentialsSource !== CredentialsSource.OAUTH)
      ? await getWebhookLogs({ sourceId: id, limit: 10 })
      : [],
  );

  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);
  let namePopoverOpen = $state(false);
  let webhookLogs = $state<WebhookLogEntry[]>([]);
  let webhookSecret = $state<string | null>(null);
  let regeneratingSecret = $state(false);

  // Sync webhook logs when data changes
  $effect(() => {
    webhookLogs = webhookLogsData;
  });

  // Generate webhook URLs (reactive)
  const webhookUrl = $derived(
    source
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/webhooks/strapi/${source.uid}`
      : "",
  );

  const notionWebhookUrl = $derived(
    source
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/webhooks/notion/${source.uid}`
      : "",
  );

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
    if (!source || (source.type !== SourceType.STRAPI && source.type !== SourceType.NOTION)) return;
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

<SiteHeader breadcrumbs={[{label: "Sources", href: "/sources"}, {label: source?.name || "Source"}]} />

{#if source}
  <div class="mx-auto max-w-2xl px-4 py-6 sm:px-6">
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
              {@const updateName = updateSource.for("name")}
              <form
                {...updateName
                  .preflight(
                    v.object({
                      id: v.string(),
                      name: v.pipe(v.string(), v.nonEmpty("Name is required")),
                    }),
                  )
                  .enhance(async ({ submit, data }) => {
                    namePopoverOpen = false;
                    await tcToast(async () => {
                      await submit().updates(
                        getSource({ id }).withOverride((s) => ({
                          ...s!,
                          ...data,
                        })),
                      );
                      toast.success("Source name updated successfully");
                    });
                  })}
                class="space-y-3"
              >
                <input {...updateName.fields.id.as("text")} type="hidden" />
                <div class="space-y-1.5">
                  <Label for={nameId}>Name</Label>
                  <Input
                    id={nameId}
                    {...updateName.fields.name.as("text")}
                    placeholder="My Content Source"
                  />
                  {#each updateName.fields.name.issues() as issue}
                    <p class="text-sm text-destructive">
                      {issue.message}
                    </p>
                  {/each}
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
                    disabled={!!updateName.pending}
                  >
                    {updateName.pending ? "Saving..." : "Save"}
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
          : "s"} · Created {new Date(source.createdAt).toLocaleDateString()}
      </p>
    </div>

    <!-- Settings form -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Connection
      </h2>
      <form
        {...updateSource.enhance(async ({ submit }) => {
          await tcToast(async () => {
            await submit();
            toast.success("Source settings updated");
          });
        })}
        class="space-y-4"
        autocomplete="off"
      >
        <input {...updateSource.fields.id.as("text")} type="hidden" />

        <div
          class="flex items-center justify-between rounded-md border border-border px-3 py-2"
        >
          <Label for={includeRefId}>Forward source item references</Label>
          <Switch
            id={includeRefId}
            {...updateSource.fields.includeRef.as("checkbox")}
            type="button"
          />
        </div>

        {#if source.type === SourceType.STRAPI || source.type === SourceType.WEB}
          <div class="space-y-1.5">
            <Label for={urlId}
              >{source.type === SourceType.STRAPI
                ? "Strapi URL"
                : "Base URL"}</Label
            >
            <Input
              id={urlId}
              {...updateSource.fields.url.as("url")}
              placeholder={source.type === SourceType.STRAPI
                ? "https://strapi.example.com"
                : "https://example.com"}
            />
            {#each updateSource.fields.url.issues() as issue}
              <p class="text-sm text-destructive">
                {issue.message}
              </p>
            {/each}
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

        {#if source.type !== SourceType.NOTION && (source.type !== 2 || (source.webAuthType ?? 0) !== 0)}
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
              {...updateSource.fields._credentials.as("password")}
              placeholder="Leave blank to keep current"
            />
            {#each updateSource.fields._credentials.issues() as issue}
              <p class="text-sm text-destructive">
                {issue.message}
              </p>
            {/each}
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
            <SaveIcon class="size-4" />
            <span class="hidden sm:inline"
              >{updateSource.pending ? "Saving..." : "Save"}</span
            >
          </Button>
          <Button
            type="button"
            variant="outline"
            onclick={handleTestConnection}
            disabled={testPending}
          >
            <ZapIcon class="size-4" />
            <span class="hidden sm:inline"
              >{testPending ? "Testing..." : "Test Connection"}</span
            >
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
          <form
            {...createSourceCollection.enhance(async ({ submit }) => {
              await submit();
              collections?.refresh();
              toast.success("Source collection added");
            })}
            class="space-y-4"
          >
            <input
              {...createSourceCollection.fields.sourceId.as("text")}
              type="hidden"
              value={source.id}
            />

            <div class="space-y-1.5">
              <Label for={webPathId}>Path or URL</Label>
              <Input
                id={webPathId}
                name="ref"
                type="text"
                placeholder="/api/posts or full URL"
                required
              />
            </div>

            <div class="space-y-1.5">
              <Label for={collectionNameId}>Collection Name</Label>
              <Input
                id={collectionNameId}
                name="name"
                type="text"
                placeholder="e.g. Blog Posts"
                required
              />
              {#each createSourceCollection.fields.name.issues() as issue}
                <p class="text-sm text-destructive">
                  {issue.message}
                </p>
              {/each}
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
        <Button size="sm" variant="outline" href="/sources/{id}/collections">
          <ChevronRightIcon class="size-4" />
          <span class="hidden sm:inline">View All</span>
        </Button>
      </div>

      {#if collections?.loading || !collections?.current}
        <p class="text-sm text-muted-foreground">Loading...</p>
      {:else if collections.current.length === 0}
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
        {#each collections.current.slice(0, 5) as collection}
          <div
            class="rounded-md border border-border px-4 py-3 text-sm font-medium"
          >
            {collection.name || "Unnamed"}
          </div>
        {/each}
      {/if}
    </section>

    <!-- Integration info (Notion only) -->
    {#if source.type === SourceType.NOTION}
      <section class="mb-8">
        <h2
          class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Integration
        </h2>
        <div class="rounded-lg border border-border p-4">
          <p class="text-sm text-muted-foreground">
            {#if source.credentialsSource === CredentialsSource.OAUTH}
              Connected via OAuth
            {:else if source.credentialsSource === CredentialsSource.USER_PROVIDED}
              Custom integration token
            {:else}
              Unknown (legacy)
            {/if}
          </p>
        </div>
      </section>

      {#if source.credentialsSource !== CredentialsSource.OAUTH}
      <!-- Webhook Configuration (Notion) -->
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
                value={notionWebhookUrl}
                readonly
                class="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => navigator.clipboard.writeText(notionWebhookUrl)}
              >
                Copy
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Register this URL as a Notion webhook. Notion will send a verification token to this URL when the webhook is created.
            </p>
          </div>
        </div>
      </section>

      <!-- Webhook Activity Log (Notion) -->
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
              Events will appear here when Notion sends webhooks.
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
    {/if}

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      {#if source.type === SourceType.NOTION}
        <div class="flex items-center justify-between mb-4 gap-2">
          <div>
            <h3 class="text-sm font-medium">Change API Token</h3>
            <p class="text-sm text-muted-foreground">
              This will replace the current Notion integration connection.
            </p>
          </div>
          <ChangeNotionTokenDialog
            sourceId={source.id}
            onsuccess={() => toast.success("API token updated")}
          />
        </div>
      {/if}
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-medium">Delete source</h3>
          <p class="text-sm text-muted-foreground">
            This will delete all collections.
          </p>
        </div>
        <form
          {...deleteSource.enhance(async ({ submit }) => {
            await submit();
            goto("/sources");
          })}
        >
          <input
            {...deleteSource.fields.id.as("text")}
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
            <TrashIcon class="size-4" />
            Delete
          </Button>
        </form>
      </div>
    </section>
  </div>
{/if}
