<script lang="ts">
  import { page } from "$app/state";
  import { createCollection } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  // Optional query params for implicit SourceCollection creation (used by E2E tests)
  const sourceId = page.url.searchParams.get("sourceId") ?? "";
  const ref = page.url.searchParams.get("ref") ?? "";
</script>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <div class="mb-6">
    <a href="/collections" class="text-sm text-muted-foreground hover:text-foreground">
      ← Collections
    </a>
  </div>

  <div class="mb-8">
    <h1 class="text-2xl font-semibold tracking-tight">Create Collection</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Create a new collection to aggregate content from multiple sources.
    </p>
  </div>

  <form method="post" action={createCollection.action} class="space-y-5">
    <div class="space-y-1.5">
      <Label for="name">Name</Label>
      <Input
        id="name"
        name="name"
        type="text"
        placeholder="My Collection"
        required
        aria-invalid={!!createCollection.fields?.name?.issues()?.length}
      />
      {#if createCollection.fields?.name?.issues()?.length}
        <p class="text-sm text-destructive">
          {createCollection.fields?.name?.issues()?.[0]?.message}
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
