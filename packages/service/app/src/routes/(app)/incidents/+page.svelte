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

<SiteHeader icon={AlertTriangleIcon} title="Incidents" />

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
  {#if incidents.length === 0}
    <div class="rounded-lg border border-dashed border-border p-12 text-center">
      <CheckCircleIcon class="mx-auto mb-3 size-10 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">No incidents</p>
      <p class="mt-1 text-xs text-muted-foreground">All syncs are running cleanly.</p>
    </div>
  {:else}
    <p class="mb-6 text-sm text-muted-foreground">
      {incidents.length} unresolved incident{incidents.length === 1 ? "" : "s"}
    </p>

    <div class="space-y-6">
      {#each grouped as group}
        <section>
          <h2 class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.sourceCollectionName} → {group.collectionName}
          </h2>
          <div class="space-y-2">
            {#each group.items as incident (incident.id)}
              {@const resolve = resolveIncident.for(incident.id)}
              <div class="flex items-start gap-3 rounded-lg border border-border p-4">
                <AlertTriangleIcon class="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div class="flex-1 space-y-1">
                  <p class="text-sm">{incident.message}</p>
                  {#if incident.details}
                    <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {#if incident.details.property}
                        <span class="rounded bg-muted px-1.5 py-0.5">property: {incident.details.property}</span>
                      {/if}
                      {#if incident.details.cast}
                        <span class="rounded bg-muted px-1.5 py-0.5">cast: {incident.details.cast}</span>
                      {/if}
                      {#if incident.details.totalFailed}
                        <span class="rounded bg-muted px-1.5 py-0.5">{incident.details.totalFailed} items affected</span>
                      {/if}
                    </div>
                  {/if}
                  <p class="text-xs text-muted-foreground">{formatDate(incident.createdAt)}</p>
                </div>
                <form
                  {...resolve.enhance(async ({ submit }) => {
                    await submit().updates(incidentsQuery);
                    toast.success("Incident resolved");
                  })}
                >
                  <input {...resolve.fields.id.as("text")} type="hidden" value={incident.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={resolve.pending > 0}>
                    Resolve
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
