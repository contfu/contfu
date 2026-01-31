<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ClockIcon from "@lucide/svelte/icons/clock";

  let { approved }: { approved: boolean } = $props();
</script>

{#if approved}
  <Badge variant="outline" class="gap-1 border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
    <CheckIcon class="size-3" />
    Approved
  </Badge>
{:else}
  <Badge variant="outline" class="gap-1 border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
    <ClockIcon class="size-3" />
    Pending
  </Badge>
{/if}
