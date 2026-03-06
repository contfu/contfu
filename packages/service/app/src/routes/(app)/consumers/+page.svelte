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

<SiteHeader icon={UsersIcon} title="consumers">
  <div class="ml-auto">
    <Button href="/consumers/new">
      <PlusIcon class="size-3" />
      <span class="hidden sm:inline">add</span>
    </Button>
  </div>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu consumers list
  </p>

  {#if consumers.loading || !consumers.current}
    <p class="text-xs text-muted-foreground">loading...</p>
  {:else if consumers.current.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no consumers configured</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Create a consumer to generate an API key for accessing your synced content.
      </p>
      <Button href="/consumers/new" class="mt-4">add consumer</Button>
    </div>
  {:else}
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">connections</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">status</th>
            <th class="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">created</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each consumers.current as consumer}
            {@const del = deleteConsumer.for(consumer.id)}
            <tr class="hover:bg-muted/30 transition-colors duration-100">
              <td class="px-3 py-2">
                <a href="/consumers/{consumer.id}" class="hover:text-primary transition-colors duration-150">
                  {consumer.name || "unnamed"}
                </a>
              </td>
              <td class="px-3 py-2 text-right text-muted-foreground">
                {consumer.connectionCount}
              </td>
              <td class="px-3 py-2">
                <span class="inline-flex items-center gap-1.5 text-xs {consumer.isActive ? 'text-success' : 'text-muted-foreground'}">
                  <span class="h-1.5 w-1.5 rounded-full {consumer.isActive ? 'bg-success' : 'bg-muted-foreground/40'}"></span>
                  {consumer.isActive ? "active" : "offline"}
                </span>
              </td>
              <td class="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                {consumer.createdAt ? new Date(consumer.createdAt).toLocaleDateString() : "--"}
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button {...props} href="/consumers/{consumer.id}" variant="ghost" size="icon-sm">
                            <PencilIcon class="size-3" />
                          </Button>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>edit</Tooltip.Content>
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
                      <input {...deleteConsumer.fields.id.as("text")} type="hidden" value={consumer.id} />
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
                                if (!confirm("Delete this consumer? The API key will be revoked.")) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <TrashIcon class="size-3" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>delete</Tooltip.Content>
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
