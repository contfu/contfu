<script lang="ts">
  // @ts-nocheck
  import { page } from "$app/state";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { createCollection } from "$lib/remote/collections.remote";
  import { useId } from "bits-ui";

  function toCamelCase(input: string): string {
    return input
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .replace(/ (.)/g, (_, char: string) => char.toUpperCase())
      .replace(/^[A-Z]/, (c) => c.toLowerCase());
  }

  const displayNameId = useId();
  const nameId = useId();

  // Optional query params for implicit SourceCollection creation (used by E2E tests)
  const sourceId = page.url.searchParams.get("sourceId") ?? "";
  const ref = page.url.searchParams.get("ref") ?? "";

  let displayName = $state("");
  let nameOverride = $state("");
  let nameEditable = $state(false);

  const derivedName = $derived(toCamelCase(displayName));
  const nameValue = $derived(nameEditable ? nameOverride : derivedName);
</script>

<SiteHeader title="new collection">
  <a
    href="/collections"
    class="ml-auto text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; collections
  </a>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-8 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu collections create
  </p>

  <form method="post" action={createCollection.action} class="space-y-5">
    <div class="space-y-1.5">
      <Label for={displayNameId}>Display Name</Label>
      <Input
        id={displayNameId}
        name="displayName"
        placeholder="Blog Posts"
        required
        bind:value={displayName}
        aria-invalid={!!createCollection.error}
      />
      {#if createCollection.error}
        <p class="text-sm text-destructive">
          {createCollection.error}
        </p>
      {/if}
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <Label for={nameId}>Identifier Name</Label>
        {#if !nameEditable}
          <button
            type="button"
            class="text-xs text-muted-foreground underline hover:text-foreground"
            onclick={() => { nameOverride = derivedName; nameEditable = true; }}
          >
            Edit
          </button>
        {:else}
          <button
            type="button"
            class="text-xs text-muted-foreground underline hover:text-foreground"
            onclick={() => { nameEditable = false; nameOverride = ""; }}
          >
            Reset
          </button>
        {/if}
      </div>
      {#if nameEditable}
        <Input
          id={nameId}
          name="name"
          bind:value={nameOverride}
          placeholder="blogPosts"
        />
      {:else}
        <input type="hidden" name="name" value={nameValue} />
        <p id={nameId} class="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
          {nameValue || "…"}
        </p>
      {/if}
      <p class="text-xs text-muted-foreground">Auto-derived from display name. Used as a camelCase identifier in generated types.</p>
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
