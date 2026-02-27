<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn } from "./utils.js";

  type Option = { value: string; label: string };

  let {
    value = $bindable(""),
    name,
    id,
    class: className,
    disabled,
    placeholder,
    size = "default",
    options,
    children,
    ...restProps
  }: Omit<HTMLSelectAttributes, "size" | "value"> & {
    value?: string;
    size?: "sm" | "default";
    options?: Option[];
    children?: Snippet;
  } = $props();
</script>

<div class="relative">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <select
    bind:value
    {name}
    {id}
    {disabled}
    data-slot="select-trigger"
    data-size={size}
    class={cn(
      "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 appearance-none [appearance:base-select]",
      className,
    )}
    {...restProps}
  >
    {#if placeholder}
      <option value="" disabled selected hidden>{placeholder}</option>
    {/if}
    {#if options}
      {#each options as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </select>
  <ChevronDownIcon
    class="text-muted-foreground pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50"
    aria-hidden="true"
  />
</div>

<style>
  /* Progressive enhancement: custom dropdown in supporting browsers (Chrome 133+) */
  select::picker(select) {
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 0.25rem;
  }

  /* Hide default arrow when base-select is supported */
  select:has(::picker(select)) + :global(svg) {
    display: none;
  }

  select option {
    padding: 0.375rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  select option:hover {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  select option:checked {
    background: var(--accent);
  }

  select option:checked::checkmark {
    color: var(--primary);
  }
</style>
