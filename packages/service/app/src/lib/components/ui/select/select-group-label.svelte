<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let { class: className, ...restProps }: SelectPrimitive.GroupHeadingProps = $props();
</script>

<SelectPrimitive.GroupHeading
	class={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
	{...restProps}
/>
