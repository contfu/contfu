<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { UserRole } from "$lib/constants/user";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";

  let { role }: { role: number } = $props();
</script>

{#if role === UserRole.ADMIN}
  <Badge variant="default" class="gap-1">
    <ShieldCheckIcon class="size-3" />
    Admin
  </Badge>
{:else}
  <Badge variant="outline">
    User
  </Badge>
{/if}
