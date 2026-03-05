<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  let {
    children,
    class: className,
    ...restProps
  }: HTMLAnchorAttributes & { children: Snippet } = $props();
</script>

<a
  class={cn("transition-colors hover:text-foreground", className)}
  {...restProps}
>
  {@render children()}
</a>
