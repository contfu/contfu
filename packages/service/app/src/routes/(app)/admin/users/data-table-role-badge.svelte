<script lang="ts">
  import { UserRole } from "$lib/constants/user";

  let { role }: { role: number } = $props();
</script>

{#if role === UserRole.ADMIN}
  <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 14l-3-3 1.5-1.5L8 11l4.5-4.5L14 8l-6 6z" />
    </svg>
    Admin
  </span>
{:else}
  <span class="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs">
    User
  </span>
{/if}
