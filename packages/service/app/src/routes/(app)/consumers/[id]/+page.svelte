<script lang="ts">
  import { goto } from "$app/navigation";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import { getCollections } from "$lib/remote/collections.remote";
  import {
    addConnection,
    getConnectionsByConsumer,
    removeConnection,
  } from "$lib/remote/connections.remote";
  import {
    deleteConsumer,
    getConsumer,
    regenerateKey,
    updateConsumer,
  } from "$lib/remote/consumers.remote";
  import { cn } from "$lib/utils";
  import { tcToast } from "$lib/utils/toast";
  import {
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
    Tooltip,
  } from "$lib/components/ui/tooltip";
  import { ClipboardIcon, LinkIcon, TrashIcon, UnlinkIcon } from "@lucide/svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { toast } from "svelte-sonner";
  import * as v from "valibot";

  const nameId = useId();

  let { params } = $props();

  let id = $derived(params.id);
  const client = $derived(await getConsumer({ id }));

  // Sync form fields when client changes
  $effect(() => {
    updateConsumer.fields.set(client);
  });

  // Query objects - auto-refresh after form submissions
  const connectionsQuery = $derived(
    getConnectionsByConsumer({ consumerId: params.id }),
  );
  const allCollections = $derived(await getCollections());

  // Derived from query.current
  const connectedCollectionIds = $derived(
    new Set((connectionsQuery?.current ?? []).map((c) => c.collectionId)),
  );
  const availableCollections = $derived(
    allCollections.filter((c) => !connectedCollectionIds.has(c.id)),
  );

  let namePopoverOpen = $state(false);
  let selectedCollectionId = $state<number | null>(null);

  // Initialize selected collection when available
  $effect(() => {
    if (selectedCollectionId === null && availableCollections.length > 0) {
      selectedCollectionId = availableCollections[0].id;
    }
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<SiteHeader>
  <a
    href="/consumers"
    class="text-sm text-muted-foreground hover:text-foreground"
  >
    ← Consumers
  </a>
</SiteHeader>

{#if client}
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <div class="mb-8">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {client.name || "Unnamed Consumer"}
        </h1>
        <span
          class="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium {client.isActive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
            : 'border-border text-muted-foreground'}"
        >
          <span
            class="h-2 w-2 rounded-full {client.isActive
              ? 'bg-emerald-500'
              : 'bg-muted-foreground/40'}"
          ></span>
          {client.isActive ? "Active" : "Offline"}
        </span>
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
              <form
                {...updateConsumer
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
                        getConsumer({ id }).withOverride((c) => ({
                          ...c!,
                          ...data,
                        })),
                      );
                      toast.success("Consumer updated successfully");
                    });
                  })}
                class="space-y-3"
              >
                <input {...updateConsumer.fields.id.as("text")} type="hidden" />
                <div class="space-y-1.5">
                  <Label for={nameId}>Name</Label>
                  <Input
                    id={nameId}
                    {...updateConsumer.fields.name.as("text")}
                    placeholder="My Application"
                  />
                  {#each updateConsumer.fields.name.issues() as issue}
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
                    disabled={!!updateConsumer.pending}
                  >
                    {updateConsumer.pending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        {client.connectionCount} collection{client.connectionCount === 1
          ? ""
          : "s"} · Created {new Date(client.createdAt).toLocaleDateString()}
      </p>
    </div>

    <!-- API Key -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        API Key
      </h2>

      {#if regenerateKey.result?.success}
        <Alert.Root class="mb-4">
          <Alert.Title>New API Key</Alert.Title>
          <Alert.Description>
            <p class="mb-2 text-xs">
              Copy this key now. It won't be shown again.
            </p>
            <div class="flex items-center gap-2 w-full">
              <code
                class="flex-1 rounded bg-muted p-2 font-mono text-xs break-all"
              >
                {regenerateKey.result?.key}
              </code>
              <Button
                variant="outline"
                size="sm"
                onclick={() => copyToClipboard(regenerateKey.result?.key ?? "")}
              >
                <ClipboardIcon />
                Copy
              </Button>
            </div>
          </Alert.Description>
        </Alert.Root>
      {/if}

      <div
        class="flex items-center justify-between rounded-md border border-border p-4"
      >
        <div>
          <p class="text-sm font-medium">Regenerate key</p>
          <p class="text-xs text-muted-foreground">
            Current key will be revoked
          </p>
        </div>
        <form {...regenerateKey}>
          <input
            {...regenerateKey.fields.id.as("text")}
            type="hidden"
            value={client.id}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!!regenerateKey.pending}
            type="submit"
          >
            {regenerateKey.pending ? "..." : "Regenerate"}
          </Button>
        </form>
      </div>
    </section>

    <!-- Connections -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Collections
      </h2>

      <svelte:boundary>
        {#snippet pending()}
          <p class="mb-4 text-sm text-muted-foreground">Loading...</p>
        {/snippet}
        <div class="mb-4 space-y-2">
          {#each await connectionsQuery as connection}
            <div
              class="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <span class="text-sm font-medium"
                >{connection.collectionName}</span
              >
              <form
                {...removeConnection.enhance(async ({ submit }) => {
                  await submit();
                  toast.success("Collection disconnected");
                })}
                class="inline"
              >
                <input
                  {...removeConnection.fields.consumerId.as("text")}
                  type="hidden"
                  value={client.id}
                />
                <input
                  {...removeConnection.fields.collectionId.as("text")}
                  type="hidden"
                  value={connection.collectionId}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button type="submit" variant="ghost" size="icon-sm">
                        <UnlinkIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Disconnect</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </form>
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">
              No collections connected.
            </p>
          {/each}
        </div>
        {#snippet failed(error)}
          <p class="mb-4 text-sm text-muted-foreground">
            Error loading collections: {(error as any).message}
          </p>
        {/snippet}
      </svelte:boundary>

      {#if availableCollections.length > 0}
        <form
          {...addConnection.enhance(async ({ submit }) => {
            await submit();
            toast.success("Collection connected");
          })}
          class="flex gap-2"
        >
          <input
            {...addConnection.fields.consumerId.as("text")}
            type="hidden"
            value={client.id}
          />
          <select
            name="collectionId"
            class="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            bind:value={selectedCollectionId}
          >
            {#each availableCollections as collection}
              <option value={collection.id}>{collection.name}</option>
            {/each}
          </select>
          <Button type="submit" variant="outline" size="sm">
            <LinkIcon />
            <span class="hidden sm:inline">Connect</span>
          </Button>
        </form>
      {:else if allCollections.length === 0}
        <p class="text-sm text-muted-foreground">
          No collections available. Create collections in your sources first.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">
          All collections are connected.
        </p>
      {/if}
    </section>

    <!-- Danger zone -->
    <section class="rounded-lg border border-destructive/30 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Delete consumer</h3>
          <p class="text-sm text-muted-foreground">API key will be revoked.</p>
        </div>
        <form
          {...deleteConsumer.enhance(async ({ submit }) => {
            await submit();
            goto("/consumers");
          })}
        >
          <input
            {...deleteConsumer.fields.id.as("text")}
            type="hidden"
            value={client.id}
          />
          <Button
            variant="destructive"
            size="sm"
            type="submit"
            onclick={(e: MouseEvent) => {
              if (!confirm(`Delete "${client.name || "this consumer"}"?`)) {
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
