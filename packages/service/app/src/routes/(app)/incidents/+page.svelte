<script lang="ts">
  // @ts-nocheck
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getIncidents, resolveIncident } from "$lib/remote/incidents.remote";
  import { AlertTriangleIcon, CheckCircleIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const incidentsQuery = getIncidents();
  const incidents = $derived(incidentsQuery?.current ?? []);

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleString();
  }

  // Group incidents by collection + source collection
  const grouped = $derived.by(() => {
    const groups = new Map<string, { collectionName: string; sourceCollectionName: string; items: typeof incidents }>();
    for (const incident of incidents) {
      const key = `${incident.collectionId}:${incident.sourceCollectionId}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          collectionName: incident.collectionName,
          sourceCollectionName: incident.sourceCollectionName,
          items: [],
        };
        groups.set(key, group);
      }
      group.items.push(incident);
    }
    return [...groups.values()];
  });
</script>

<SiteHeader icon={AlertTriangleIcon} title="incidents" />

<div class="page-shell px-4 py-8 sm:px-6">
  {#if incidents.length === 0}
    <div class="border border-dashed border-border p-12 text-center">
      <CheckCircleIcon class="mx-auto mb-3 size-8 text-success/50" />
      <p class="text-xs text-muted-foreground">no incidents</p>
      <p class="mt-1 text-[10px] text-muted-foreground">all syncs running cleanly</p>
    </div>
  {:else}
    <p class="mb-6 text-xs text-muted-foreground">
      <span class="text-warning">{incidents.length}</span> unresolved incident{incidents.length === 1 ? "" : "s"}
    </p>

    <div class="space-y-6">
      {#each grouped as group}
        <section>
          <h2 class="mb-3 text-xs text-muted-foreground">
            {group.sourceCollectionName} <span class="text-primary">></span> {group.collectionName}
          </h2>
          <div class="space-y-2">
            {#each group.items as incident (incident.id)}
              {@const resolve = resolveIncident.for(incident.id)}
              <div class="flex items-start gap-3 border border-border p-3">
                <AlertTriangleIcon class="mt-0.5 size-3 shrink-0 text-warning" />
                <div class="flex-1 space-y-1">
                  <p class="text-xs">{incident.message}</p>
                  {#if incident.details}
                    <div class="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      {#if incident.details.property}
                        <span class="border border-border bg-muted px-1.5 py-0.5">property: {incident.details.property}</span>
                      {/if}
                      {#if incident.details.cast}
                        <span class="border border-border bg-muted px-1.5 py-0.5">cast: {incident.details.cast}</span>
                      {/if}
                      {#if incident.details.totalFailed}
                        <span class="border border-border bg-muted px-1.5 py-0.5">{incident.details.totalFailed} affected</span>
                      {/if}
                    </div>
                  {/if}
                  <p class="text-[10px] text-muted-foreground">{formatDate(incident.createdAt)}</p>
                </div>
                <form
                  {...resolve.enhance(async ({ submit }) => {
                    await submit().updates(incidentsQuery);
                    toast.success("Incident resolved");
                  })}
                >
                  <input {...resolve.fields.id.as("text")} type="hidden" value={incident.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={resolve.pending > 0}>
                    resolve
                  </Button>
                </form>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>
