<svelte:head>
	<title>Registration Complete - Contfu</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
	<div class="auth-shell">
		<div class="mb-6">
			<p class="text-xs text-muted-foreground mb-1">session/register</p>
			<h1 class="text-xl font-semibold">
				<span class="text-primary">></span> account created
			</h1>
		</div>

		<div class="mb-6 border border-primary/30 bg-primary/5 p-4">
			<div class="text-xs text-primary mb-1">--verify</div>
			<p class="text-xs text-muted-foreground">
				We've sent a verification email to your inbox. Click the link in that email to activate your
				account and continue.
			</p>
		</div>

		<p class="text-xs text-muted-foreground">You can close this tab. Everything continues from the email.</p>

		<p class="mt-6 text-center text-xs text-muted-foreground">
			Already verified? <a href="/login" class="text-primary hover:underline">login</a>
		</p>
	</div>
</div>
