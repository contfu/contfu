<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { deleteSource, getSources } from "$lib/remote/sources.remote";
  import {
    DatabaseIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
  } from "@lucide/svelte";

  // Query object - auto-refreshes after form submissions
  const sources = getSources();

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "notion",
    1: "strapi",
    2: "web",
  };
</script>

<SiteHeader icon={DatabaseIcon} title="sources">
  <div class="ml-auto">
    <Button href="/sources/new">
      <PlusIcon class="size-3" />
      <span class="hidden sm:inline">add</span>
    </Button>
  </div>
</SiteHeader>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <p class="mb-6 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu sources --manage
  </p>

  {#if sources.loading || !sources.current}
    <p class="text-xs text-muted-foreground">loading...</p>
  {:else if sources.current.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <p class="text-sm text-muted-foreground">no sources configured</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Connect a CMS to start syncing content.
      </p>
      <Button href="/sources/new" class="mt-4">add source</Button>
    </div>
  {:else}
    <div class="border border-border">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">name</th>
            <th class="px-3 py-2 text-left font-medium text-muted-foreground">type</th>
            <th class="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">url</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground">collections</th>
            <th class="px-3 py-2 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each sources.current as source}
            {@const del = deleteSource.for(source.id)}
            <tr class="hover:bg-muted/30 transition-colors duration-100">
              <td class="px-3 py-2">
                <a href="/sources/{source.id}" class="hover:text-primary transition-colors duration-150">
                  {source.name || "unnamed"}
                </a>
                <div class="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(source.createdAt).toLocaleDateString()}
                </div>
              </td>
              <td class="px-3 py-2">
                <span class="text-muted-foreground">
                  {SOURCE_TYPE_LABELS[source.type] ?? "unknown"}
                </span>
              </td>
              <td class="hidden max-w-[200px] truncate px-3 py-2 text-muted-foreground sm:table-cell" title={source.url || ""}>
                {source.url || "--"}
              </td>
              <td class="px-3 py-2 text-right text-muted-foreground">
                {source.collectionCount}
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button {...props} href="/sources/{source.id}" variant="ghost" size="icon-sm">
                            <PencilIcon class="size-3" />
                          </Button>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>edit</Tooltip.Content>
                    </Tooltip.Root>
                    <form
                      {...del.enhance(({ submit }) =>
                        submit().updates(
                          sources.withOverride((sources) =>
                            sources.filter((s) => s.id !== source.id),
                          ),
                        ),
                      )}
                      class="inline"
                    >
                      <input {...del.fields.id.as("text")} type="hidden" value={source.id} />
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
                                if (!confirm("Delete this source? All collections will also be deleted.")) {
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
