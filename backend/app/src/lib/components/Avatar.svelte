<script lang="ts">
	import type { DisplayUser } from "$lib/server/auth/session";

	let { user }: { user: DisplayUser } = $props();
</script>

{#if user.image}
	<img
		class="bg-primary-100 text-primary-600 ring-primary-600 dark:bg-primary-900 dark:text-primary-400 dark:ring-primary-400 flex h-12 w-12 items-center justify-center rounded-full ring-1"
		src={user.image}
		width={32}
		height={32}
		alt={user.name}
	/>
{:else}
	<div
		class="bg-primary-100 text-primary-600 ring-primary-400 dark:bg-primary-900 dark:text-primary-400 dark:ring-primary-500 flex h-12 w-12 items-center justify-center rounded-full ring-1"
	>
		{user.name[0].toUpperCase()}
	</div>
{/if}
