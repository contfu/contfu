<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	let {
		value,
		label,
		class: className,
		icon,
		...restProps
	}: SelectPrimitive.ItemProps & { icon?: Snippet } = $props();
</script>

<SelectPrimitive.Item
	{value}
	{label}
	class={cn(
		"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
		className,
	)}
	{...restProps}
>
	{#snippet children({ selected })}
		{@render icon?.()}
		<span class={cn("flex-1 truncate", selected && "font-medium")}>{label ?? value}</span>
		{#if selected}
			<span class="ml-auto h-3.5 w-3.5 shrink-0 text-xs opacity-60">✓</span>
		{/if}
	{/snippet}
</SelectPrimitive.Item>
