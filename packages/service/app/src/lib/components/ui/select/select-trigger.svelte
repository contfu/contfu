<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	let {
		placeholder = "",
		class: className,
		children,
		...restProps
	}: SelectPrimitive.TriggerProps & { placeholder?: string; children?: Snippet } = $props();
</script>

<SelectPrimitive.Trigger
	class={cn(
		"flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
		className,
	)}
	{...restProps}
>
	<span class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
		{#if children}
			{@render children()}
		{:else}
			<span class="text-muted-foreground">{placeholder}</span>
		{/if}
	</span>
	<ChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
</SelectPrimitive.Trigger>
