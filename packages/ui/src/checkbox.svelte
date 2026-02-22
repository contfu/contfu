<script lang="ts">
	import { cn } from "./utils.js";
	import type { HTMLInputAttributes } from "svelte/elements";

	let {
		checked = $bindable(false),
		name,
		id,
		class: className,
		disabled,
		...restProps
	}: HTMLInputAttributes & {
		checked?: boolean;
	} = $props();
</script>

<input
	type="checkbox"
	bind:checked
	{name}
	{id}
	{disabled}
	data-slot="checkbox"
	class={cn(
		"border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 peer size-4 shrink-0 rounded-[4px] border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:border-primary checked:bg-primary",
		className
	)}
	{...restProps}
/>

<style>
	input[type="checkbox"]:checked {
		background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
		background-size: 100% 100%;
		background-position: center;
		background-repeat: no-repeat;
	}
</style>
