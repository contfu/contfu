<script lang="ts">
  import { cn } from "$lib/utils";
  import { ChevronRightIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";

  let {
    children,
    class: className,
    ...restProps
  }: HTMLLiAttributes & { children?: Snippet } = $props();
</script>

<li
  role="presentation"
  aria-hidden="true"
  class={cn("[&>svg]:size-3.5", className)}
  {...restProps}
>
  {#if children}
    {@render children()}
  {:else}
    <ChevronRightIcon />
  {/if}
</li>
