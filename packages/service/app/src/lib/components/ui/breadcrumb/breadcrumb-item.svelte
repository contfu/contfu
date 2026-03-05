<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";

  let {
    children,
    class: className,
    ...restProps
  }: HTMLLiAttributes & { children: Snippet } = $props();
</script>

<li
  class={cn("inline-flex items-center gap-1.5", className)}
  {...restProps}
>
  {@render children()}
</li>
