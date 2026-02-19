<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { deleteConsumer, getConsumers } from "$lib/remote/consumers.remote";
  import { tcToast } from "$lib/utils/toast";
  import { PencilIcon, PlusIcon, TrashIcon, UsersIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  // Query object - auto-refreshes after form submissions
  const consumers = getConsumers();
</script>

<SiteHeader icon={UsersIcon} title="Consumers">
  <div class="ml-auto">
    <Button href="/consumers/new">
      <PlusIcon class="size-4" />
      <span class="hidden sm:inline">Add Consumer</span>
    </Button>
  </div>
</SiteHeader>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <p class="mb-6 text-sm text-muted-foreground">
    Manage API access for your applications
  </p>

  {#if consumers.loading || !consumers.current}
    <p class="text-muted-foreground">Loading...</p>
  {:else if consumers.current.length === 0}
    <div class="rounded-lg border border-dashed border-border p-12 text-center">
      <p class="text-muted-foreground">No consumers configured</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Create a consumer to generate an API key for accessing your synced
        content.
      </p>
      <Button href="/consumers/new" class="mt-4">Add your first consumer</Button
      >
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-4 py-3 text-left font-medium text-muted-foreground"
              >Name</th
            >
            <th class="px-4 py-3 text-right font-medium text-muted-foreground"
              >Connections</th
            >
            <th class="px-4 py-3 text-left font-medium text-muted-foreground"
              >Status</th
            >
            <th
              class="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell"
              >Created</th
            >
            <th class="px-4 py-3 text-right font-medium text-muted-foreground"
            ></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each consumers.current as consumer}
            {@const del = deleteConsumer.for(consumer.id)}
            <tr class="hover:bg-muted/30">
              <td class="px-4 py-3">
                <a
                  href="/consumers/{consumer.id}"
                  class="font-medium hover:underline"
                >
                  {consumer.name || "Unnamed Consumer"}
                </a>
              </td>
              <td class="px-4 py-3 text-right font-mono">
                {consumer.connectionCount}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-2 text-xs font-medium {consumer.isActive
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'}"
                >
                  <span
                    class="h-2 w-2 rounded-full {consumer.isActive
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/40'}"
                  ></span>
                  {consumer.isActive ? "Active" : "Offline"}
                </span>
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {consumer.createdAt
                  ? new Date(consumer.createdAt).toLocaleDateString()
                  : "—"}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button {...props} href="/consumers/{consumer.id}" variant="ghost" size="icon-sm">
                            <PencilIcon />
                          </Button>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>Edit</Tooltip.Content>
                    </Tooltip.Root>
                    <form
                      {...del.enhance(async ({ submit }) => {
                        if (del.pending) return;
                        await tcToast(async () => {
                          await submit().updates(
                            consumers.withOverride((consumers) =>
                              consumers.filter((c) => c.id !== consumer.id),
                            ),
                          );
                          toast.success("Consumer deleted");
                        });
                      })}
                      class="inline"
                    >
                      <input
                        {...deleteConsumer.fields.id.as("text")}
                        type="hidden"
                        value={consumer.id}
                      />
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              class="text-destructive hover:text-destructive"
                              onclick={(e: MouseEvent) => {
                                if (
                                  !confirm(
                                    "Delete this consumer? The API key will be revoked.",
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <TrashIcon />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Delete</Tooltip.Content>
                      </Tooltip.Root>
                    </form>
                  </Tooltip.Provider>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
