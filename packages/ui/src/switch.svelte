<script lang="ts">
	import { cn } from "./utils.js";
	import type { HTMLButtonAttributes } from "svelte/elements";

	type Props = Omit<HTMLButtonAttributes, "type" | "value"> & {
		checked?: boolean;
		name?: string;
		onValue?: string;
		offValue?: string;
		type?: string;
		value?: unknown;
	};

	let {
		checked = $bindable(false),
		name,
		id,
		class: className,
		disabled,
		onValue = "true",
		offValue = "false",
		type: _type,
		value: _value,
		...restProps
	}: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	data-state={checked ? "checked" : "unchecked"}
	data-slot="switch"
	{id}
	{disabled}
	class={cn(
		"data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	onclick={() => (checked = !checked)}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			checked = !checked;
		}
	}}
	{...restProps}
>
	<span
		data-slot="switch-thumb"
		data-state={checked ? "checked" : "unchecked"}
		class="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
	></span>
</button>
{#if name}
	<input type="hidden" {name} value={checked ? onValue : offValue} />
{/if}
