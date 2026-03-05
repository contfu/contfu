<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { HTMLOlAttributes } from "svelte/elements";

  let {
    children,
    class: className,
    ...restProps
  }: HTMLOlAttributes & { children: Snippet } = $props();
</script>

<ol
  class={cn(
    "flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:gap-2",
    className,
  )}
  {...restProps}
>
  {@render children()}
</ol>
