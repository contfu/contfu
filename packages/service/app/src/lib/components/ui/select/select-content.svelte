<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		class: className,
		sideOffset = 4,
		children,
		...restProps
	}: SelectPrimitive.ContentProps & { sideOffset?: number } = $props();
</script>

<SelectPrimitive.Content
	class={cn(
		"bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-md border shadow-md",
		className,
	)}
	{sideOffset}
	{...restProps}
>
	<SelectPrimitive.Viewport class="p-1">
		{@render children?.()}
	</SelectPrimitive.Viewport>
</SelectPrimitive.Content>
