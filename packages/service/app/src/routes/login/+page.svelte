<script lang="ts">
	import { goto } from "$app/navigation";
	import { signIn } from "$lib/auth-client";

	let email = $state("");
	let password = $state("");
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleEmailLogin(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		submitting = true;

		try {
			const result = await signIn.email({ email, password });
			if (result.error) {
				error = result.error.message ?? "Login failed";
			} else {
				goto("/dashboard");
			}
		} catch (err) {
			error = "An unexpected error occurred";
		} finally {
			submitting = false;
		}
	}

	async function handleOAuthLogin(provider: "github" | "google") {
		error = null;
		try {
			await signIn.social({ provider, callbackURL: "/dashboard" });
		} catch (err) {
			error = "An unexpected error occurred";
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
	<div class="container mx-auto px-4">
		<div class="mx-auto max-w-md">
			<div class="rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
				<h2 class="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-white">Login to your account</h2>

				<form onsubmit={handleEmailLogin} class="space-y-6">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Email address
						</label>
						<input
							type="email"
							name="email"
							id="email"
							bind:value={email}
							class="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Password
						</label>
						<input
							type="password"
							name="password"
							id="password"
							bind:value={password}
							class="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div>
						<button
							type="submit"
							disabled={submitting}
							class={`bg-primary-400 hover:bg-primary-500 focus:ring-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400 w-full rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
								submitting ? "cursor-not-allowed opacity-75" : ""
							}`}
						>
							{submitting ? "Signing in..." : "Sign in"}
						</button>
					</div>

					{#if error}
						<div class="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-400">
							{error}
						</div>
					{/if}
				</form>

				<div class="mt-6">
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
								Or continue with
							</span>
						</div>
					</div>

					<div class="mt-6 grid grid-cols-2 gap-3">
						<button
							type="button"
							onclick={() => handleOAuthLogin("github")}
							class="focus:ring-primary-500 flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						>
							<svg class="h-5 w-5" viewBox="0 0 24 24">
								<path
									fill="currentColor"
									d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
								/>
							</svg>
							GitHub
						</button>
						<button
							type="button"
							onclick={() => handleOAuthLogin("google")}
							class="focus:ring-primary-500 flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						>
							<svg class="h-5 w-5" viewBox="0 0 24 24">
								<path
									fill="currentColor"
									d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
								/>
							</svg>
							Google
						</button>
					</div>
				</div>

				<p class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
					Don't have an account?
					<a href="/register" class="text-primary-500 hover:text-primary-600 font-medium">
						Sign up
					</a>
				</p>
			</div>
		</div>
	</div>
</div>
