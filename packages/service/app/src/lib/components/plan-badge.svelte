<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { PlanTier, type PlanTier as PlanTierType } from "@contfu/svc-backend/infra/polar/products";

  let { plan }: { plan: PlanTierType } = $props();

  const config: Record<number, { label: string; class: string }> = {
    [PlanTier.FREE]: {
      label: "Free",
      class: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    },
    [PlanTier.STARTER]: {
      label: "Starter",
      class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    [PlanTier.PRO]: {
      label: "Pro",
      class: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    },
    [PlanTier.BUSINESS]: {
      label: "Business",
      class: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
  };

  const tier = $derived(config[plan] ?? config[PlanTier.FREE]);
</script>

<Badge variant="outline" class={tier.class}>{tier.label}</Badge>
