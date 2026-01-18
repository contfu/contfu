<script lang="ts">
	import Avatar from "./Avatar.svelte";
	import type { DisplayUser } from "$lib/server/auth/session";

	let {
		user,
		isUnderConstruction
	}: {
		user: DisplayUser | null;
		isUnderConstruction: boolean;
	} = $props();

	let isOpen = $state(false);
</script>

<header class="bg-white shadow-sm dark:bg-gray-800">
	<div class="container mx-auto px-4">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center gap-2">
				<a
					href={user ? "/dashboard" : "/"}
					class="text-xl font-bold text-gray-900 dark:text-white"
					aria-label={user ? "Go to dashboard" : "Go to home"}
				>
					<img src="/logo.svg" alt="Contfu" height={64} width={178} class="h-12" />
				</a>
			</div>
			{#if !isUnderConstruction}
				<nav class="flex h-full items-center space-x-4">
					{#if user}
						<div class="relative flex h-full items-center">
							<button
								class="peer flex h-14 items-center space-x-2 rounded-lg px-4 py-0 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								onclick={(e) => {
									if (isOpen) e.currentTarget.blur();
									else isOpen = true;
								}}
								onblur={() => (isOpen = false)}
							>
								<Avatar {user} />
							</button>
							<div
								class="absolute right-0 top-14 mt-2 hidden w-48 bg-white py-2 shadow-lg peer-focus:block dark:bg-gray-800"
								onmousedown={(e) => e.preventDefault()}
							>
								<span class="block w-full px-4 py-2 text-gray-400 dark:text-gray-500">
									{user.name}
								</span>
								<form method="POST" action="/?/logout">
									<button
										type="submit"
										class="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
									>
										Logout
									</button>
								</form>
							</div>
						</div>
					{:else}
						<a href="/#features" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
							Features
						</a>
						<a href="/#pricing" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
							Pricing
						</a>
						<a
							href="/login"
							class="bg-primary-400 hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400 rounded-lg px-4 py-2 text-sm font-medium text-white"
						>
							Login
						</a>
					{/if}
				</nav>
			{/if}
		</div>
	</div>
</header>
