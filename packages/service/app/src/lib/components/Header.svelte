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

<header
  class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
  <div class="mx-auto max-w-6xl px-4 sm:px-6">
    <div class="header-inner flex h-16 items-center justify-between">
      <!-- Logo -->
      <a href="/" class="flex items-center gap-2" aria-label="Go to home">
        <img src="/favicon.svg" alt="" height={32} width={32} class="h-8 w-8" />
        <span class="text-lg font-semibold tracking-tight text-foreground"
          >contfu</span
        >
      </a>

      {#if !isUnderConstruction}
        <nav class="flex items-center gap-3">
          <Button href="/register" size="sm">Join Beta</Button>
          <Button href="/login" variant="ghost" size="sm">Sign in</Button>
        </nav>
      {/if}
    </div>
  </div>
</header>

<style>
  .header-inner {
    animation: shrink-header linear both;
    animation-timeline: scroll();
    animation-range: 0 150px;
  }

  @keyframes shrink-header {
    from {
      height: 4rem;
    }
    to {
      height: 3rem;
    }
  }
</style>
