<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { deleteConsumer, getConsumers } from "$lib/remote/consumers.remote";
  import { tcToast } from "$lib/utils/toast";
  import { UsersIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  // Query object - auto-refreshes after form submissions
  const consumers = getConsumers();
</script>

<SiteHeader icon={UsersIcon} title="Consumers">
  <div class="ml-auto">
    <Button href="/consumers/new">Add Consumer</Button>
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
              <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {consumer.createdAt
                  ? new Date(consumer.createdAt).toLocaleDateString()
                  : "—"}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <a
                    href="/consumers/{consumer.id}"
                    class="text-primary hover:underline">Edit</a
                  >
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
                      {...deleteConsumer.fields.id.as("number")}
                      type="hidden"
                      value={consumer.id}
                    />
                    <button
                      type="submit"
                      class="text-destructive hover:underline"
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
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
