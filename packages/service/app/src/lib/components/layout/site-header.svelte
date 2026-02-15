<script lang="ts">
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { Icon as LucideIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  let {
    children,
    icon: Icon,
    title,
  }: { children?: Snippet; icon?: typeof LucideIcon; title?: string } =
    $props();
</script>

<header
  class="bg-background h-(--header-height) group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) flex shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear"
>
  <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
    <Sidebar.Trigger class="-ml-1" />
    <Separator
      orientation="vertical"
      class="mx-2 data-[orientation=vertical]:h-4"
    />
    {#if Icon}
      <Icon class="hidden flex-none xs:inline" />
    {/if}
    {#if title}
      <h1 class="flex min-w-0 items-center gap-2 text-base font-medium">
        <span class="overflow-hidden text-ellipsis whitespace-nowrap"
          >{title}</span
        >
      </h1>
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </div>
</header>
