<script lang="ts" module>
  import type { UserRole } from "@contfu/svc-backend/domain/types";

  export type DisplayUser = {
    email: string;
    name: string;
    image?: string;
    role?: UserRole;
  };
</script>

<script lang="ts">
  import Button from "./ui/button/button.svelte";

  let {
    isUnderConstruction,
  }: {
    isUnderConstruction: boolean;
  } = $props();
</script>

<header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
  <div class="mx-auto max-w-5xl px-4 sm:px-6">
    <div class="flex h-12 items-center justify-between">
      <a href="/" class="flex items-center gap-2" aria-label="Go to home">
        <img src="/favicon.svg" alt="contfu" class="h-6 w-auto" />
      </a>

      {#if !isUnderConstruction}
        <nav class="flex items-center gap-1">
          <Button href="/login" variant="ghost" size="sm">login</Button>
          <Button href="/register" size="sm">register</Button>
        </nav>
      {/if}
    </div>
  </div>
</header>
