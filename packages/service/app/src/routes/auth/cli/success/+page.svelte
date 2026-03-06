<script lang="ts">
	import { page } from "$app/state";

	const code = page.url.searchParams.get("code");
</script>

<div class="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
	<div class="page-shell text-center">
		<div
			class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950"
		>
			<svg
				class="h-6 w-6 text-emerald-600 dark:text-emerald-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>

		<h1 class="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
			{code ? "Almost there" : "Logged in"}
		</h1>

		{#if code}
			<p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
				Copy this code and paste it into your terminal.
			</p>

			<div
				class="mt-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900"
			>
				<p class="font-mono text-2xl font-semibold tracking-widest text-zinc-900 dark:text-zinc-100">
					{code}
				</p>
			</div>

			<p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">Expires in 10 minutes.</p>
		{:else}
			<p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
				Authentication complete. You can close this tab and return to your terminal.
			</p>

			<div
				class="mt-8 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-left dark:border-zinc-700 dark:bg-zinc-900"
			>
				<p class="font-mono text-xs text-zinc-500 dark:text-zinc-400">$ contfu sources list</p>
			</div>
		{/if}
	</div>
</div>
