<script lang="ts">
	import { goto } from "$app/navigation";
	import { signUp, signIn } from "$lib/auth-client";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";

	let name = $state("");
	let email = $state("");
	let password = $state("");
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSignUp(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		submitting = true;

		try {
			const result = await signUp.email({ name, email, password });
			if (result.error) {
				error = result.error.message ?? "Registration failed";
			} else {
				goto("/dashboard");
			}
		} catch {
			error = "An unexpected error occurred";
		} finally {
			submitting = false;
		}
	}

	async function handleOAuthLogin(provider: "github" | "google") {
		error = null;
		try {
			await signIn.social({ provider, callbackURL: "/dashboard" });
		} catch {
			error = "An unexpected error occurred";
		}
	}
</script>

<div class="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Create account</h1>
			<p class="mt-1 text-sm text-muted-foreground">Get started with Contfu</p>
		</div>

		<form onsubmit={handleSignUp} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="name">Name</Label>
				<Input type="text" id="name" bind:value={name} placeholder="Your name" required />
			</div>

			<div class="space-y-1.5">
				<Label for="email">Email</Label>
				<Input type="email" id="email" bind:value={email} placeholder="you@example.com" required />
			</div>

			<div class="space-y-1.5">
				<Label for="password">Password</Label>
				<Input type="password" id="password" bind:value={password} placeholder="••••••••" required minlength={8} />
			</div>

			{#if error}
				<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
			{/if}

			<Button type="submit" class="w-full" disabled={submitting}>
				{submitting ? "Creating account..." : "Create account"}
			</Button>
		</form>

		<div class="relative my-6">
			<div class="absolute inset-0 flex items-center">
				<div class="w-full border-t border-border"></div>
			</div>
			<div class="relative flex justify-center">
				<span class="bg-background px-3 text-xs text-muted-foreground">or continue with</span>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button variant="outline" onclick={() => handleOAuthLogin("github")}>
				<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
				</svg>
				GitHub
			</Button>
			<Button variant="outline" onclick={() => handleOAuthLogin("google")}>
				<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
				</svg>
				Google
			</Button>
		</div>

		<p class="mt-6 text-center text-sm text-muted-foreground">
			Already have an account?
			<a href="/login" class="font-medium text-primary hover:underline">Sign in</a>
		</p>
	</div>
</div>
