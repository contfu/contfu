<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    children,
    class: className,
    ...restProps
  }: HTMLAttributes<HTMLSpanElement> & { children: Snippet } = $props();
</script>

<span
  role="link"
  aria-disabled="true"
  aria-current="page"
  class={cn("font-normal text-foreground", className)}
  {...restProps}
>
  {@render children()}
</span>
