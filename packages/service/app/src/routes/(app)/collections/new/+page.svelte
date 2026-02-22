<script lang="ts">
  // @ts-nocheck
  import { page } from "$app/state";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { createCollection } from "$lib/remote/collections.remote";
  import { useId } from "bits-ui";

  const nameId = useId();

  // Optional query params for implicit SourceCollection creation (used by E2E tests)
  const sourceId = page.url.searchParams.get("sourceId") ?? "";
  const ref = page.url.searchParams.get("ref") ?? "";
</script>

<SiteHeader title="Create Collection">
  <a
    href="/collections"
    class="ml-auto text-sm text-muted-foreground hover:text-foreground"
  >
    ← Collections
  </a>
</SiteHeader>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <p class="mb-8 text-sm text-muted-foreground">
    Create a new collection to aggregate content from multiple sources.
  </p>

  <form method="post" action={createCollection.action} class="space-y-5">
    <div class="space-y-1.5">
      <Label for={nameId}>Name</Label>
      <Input
        id={nameId}
        name="name"
        placeholder="My Collection"
        required
        aria-invalid={!!createCollection.error}
      />
      {#if createCollection.error}
        <p class="text-sm text-destructive">
          {createCollection.error}
        </p>
      {/if}
    </div>

    <!-- Hidden fields for implicit SourceCollection creation (populated via URL params) -->
    {#if sourceId}
      <input type="hidden" name="sourceId" value={sourceId} />
    {/if}
    {#if ref}
      <input type="hidden" name="ref" value={ref} />
    {/if}

    <div class="flex gap-3 pt-2">
      <Button type="submit" disabled={!!createCollection.pending}>
        {createCollection.pending ? "Creating..." : "Create Collection"}
      </Button>
      <Button type="button" variant="outline" href="/collections">
        Cancel
      </Button>
    </div>
  </form>
</div>
