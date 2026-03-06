<script lang="ts">
  // @ts-nocheck
  import { goto } from "$app/navigation";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "$lib/components/ui/tooltip";
  import { getCollections } from "$lib/remote/collections.remote";
  import {
    addConsumerCollection,
    getConsumerCollectionsByConsumer,
    removeConsumerCollection,
    updateConsumerCollectionIncludeRef,
  } from "$lib/remote/consumer-collections.remote";
  import {
    deleteConsumer,
    getConsumer,
    getConsumerTypes,
    regenerateKey,
    updateConsumer,
  } from "$lib/remote/consumers.remote";
  import { cn } from "$lib/utils";
  import { tcToast } from "$lib/utils/toast";
  import {
    CheckIcon,
    ClipboardIcon,
    LinkIcon,
    TrashIcon,
    UnlinkIcon,
  } from "@lucide/svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { useId } from "bits-ui";
  import { toast } from "svelte-sonner";
  import * as v from "valibot";

  const nameId = useId();

  let { params } = $props();

  let id = $derived(params.id);

  // Create parameterless queries at top level so SvelteKit can track their lifecycle.
  // Creating queries inside $derived prevents $effect.pre from running, which causes
  // cache entries to be evicted after resolve, leading to infinite re-fetch loops
  // during client-side navigation.
  const collectionsQuery = getCollections();

  // Parameterized queries must be in $derived to react to param changes
  const consumerQuery = $derived(getConsumer({ id }));
  const connectionsQuery = $derived(
    getConsumerCollectionsByConsumer({ consumerId: params.id }),
  );

  // Await queries separately
  const client = $derived(await consumerQuery);
  const allCollections = $derived(await collectionsQuery);

  // Sync form fields when client changes (guarded to prevent infinite loop)
  let prevClient: typeof client;
  $effect(() => {
    if (client && client !== prevClient) {
      prevClient = client;
      updateConsumer.fields.set(client);
    }
  });

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

  let typesCopied = $state(false);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  async function copyTypes() {
    const types = await getConsumerTypes({ id: params.id });
    if (!types) return;
    await navigator.clipboard.writeText(types);
    typesCopied = true;
    setTimeout(() => (typesCopied = false), 1500);
  }
</script>

<SiteHeader>
  <a
    href="/consumers"
    class="text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; consumers
  </a>
</SiteHeader>

{#if client}
  <div class="page-shell px-4 py-8 sm:px-6">
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
                        consumerQuery.withOverride((c) => ({
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
      <div class="mt-3">
        <form
          {...updateConsumer.enhance(async ({ submit }) => {
            await tcToast(async () => {
              await submit().updates(
                consumerQuery.withOverride((c) => ({
                  ...c!,
                  includeRef: !c!.includeRef,
                })),
              );
              toast.success(
                client.includeRef
                  ? "Consumer refs disabled"
                  : "Consumer refs enabled",
              );
            });
          })}
          class="inline"
        >
          <input
            {...updateConsumer.fields.id.as("text")}
            type="hidden"
            value={client.id}
          />
          <input
            name="includeRef"
            type="hidden"
            value={client.includeRef ? "false" : "true"}
          />
          <Button type="submit" variant="outline" size="sm">
            {client.includeRef
              ? "Disable Refs For Consumer"
              : "Enable Refs For Consumer"}
          </Button>
        </form>
        <Button variant="outline" size="sm" onclick={copyTypes}>
          {#if typesCopied}
            <CheckIcon class="size-4" />
            Types Copied
          {:else}
            <ClipboardIcon class="size-4" />
            Copy Types
          {/if}
        </Button>
      </div>
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
            {@const update = updateConsumerCollectionIncludeRef.for(
              connection.collectionId,
            )}
            {@const remove = removeConsumerCollection.for(connection.collectionId)}
            <div
              class="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium"
                  >{connection.collectionName}</span
                >
                <span class="text-xs text-muted-foreground"
                  >refs: {connection.includeRef ? "on" : "off"}</span
                >
              </div>
              <div class="flex items-center gap-1">
                <form
                  {...update.enhance(async ({ submit }) => {
                    await submit();
                    toast.success(
                      connection.includeRef
                        ? "Connection refs disabled"
                        : "Connection refs enabled",
                    );
                  })}
                  class="inline"
                >
                  <input
                    {...update.fields.consumerId.as("text")}
                    type="hidden"
                    value={client.id}
                  />
                  <input
                    {...update.fields.collectionId.as("text")}
                    type="hidden"
                    value={connection.collectionId}
                  />
                  <input
                    {...update.fields.includeRef.as("text")}
                    type="hidden"
                    value={connection.includeRef ? "false" : "true"}
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    {connection.includeRef ? "Disable Refs" : "Enable Refs"}
                  </Button>
                </form>
                <form
                  {...remove.enhance(async ({ submit }) => {
                    await submit().updates(
                      consumerQuery,
                      connectionsQuery,
                    );
                    toast.success("Collection disconnected");
                  })}
                  class="inline"
                >
                  <input
                    {...remove.fields.consumerId.as("text")}
                    type="hidden"
                    value={client.id}
                  />
                  <input
                    {...remove.fields.collectionId.as("text")}
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
          {...addConsumerCollection.enhance(async ({ submit }) => {
            await submit().updates(
              consumerQuery,
              connectionsQuery,
            );
            selectedCollectionId = null;
            toast.success("Collection connected");
          })}
          class="flex gap-2"
        >
          <input
            {...addConsumerCollection.fields.consumerId.as("text")}
            type="hidden"
            value={client.id}
          />
          <select
            name="collectionId"
            class="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            bind:value={selectedCollectionId}
          >
            {#each availableCollections as collection}
              <option value={collection.id}>{collection.displayName}</option>
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
