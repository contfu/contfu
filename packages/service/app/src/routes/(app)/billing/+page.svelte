<script lang="ts">
	import { authClient } from "$lib/auth-client";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";

	let { data } = $props();

	async function handleCheckout(productId: string) {
		const result = await authClient.checkout({ productId });
		if (result.data?.url) {
			window.location.href = result.data.url;
		}
	}

	async function openCustomerPortal() {
		const result = await authClient.customer.portal();
		if (result.data?.url) {
			window.location.href = result.data.url;
		}
	}
</script>

<div class="container mx-auto max-w-4xl p-6">
	<div class="mb-8">
		<h1 class="text-2xl font-bold">Billing</h1>
		<p class="text-muted-foreground">Manage your subscription and billing</p>
	</div>

	{#if data.quota?.subscriptionStatus === "active"}
		<Card.Root class="mb-8">
			<Card.Header>
				<Card.Title>Current Subscription</Card.Title>
				<Card.Description>You have an active subscription</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Status:</span>
						<span class="font-medium capitalize">{data.quota.subscriptionStatus}</span>
					</div>
					{#if data.quota.currentPeriodEnd}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Current period ends:</span>
							<span class="font-medium">
								{new Date(data.quota.currentPeriodEnd * 1000).toLocaleDateString()}
							</span>
						</div>
					{/if}
				</div>
			</Card.Content>
			<Card.Footer>
				<Button onclick={openCustomerPortal}>Manage Subscription</Button>
			</Card.Footer>
		</Card.Root>
	{/if}

	<div class="mb-8">
		<h2 class="mb-4 text-xl font-semibold">Available Plans</h2>
		<div class="grid gap-6 md:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>Pro</Card.Title>
					<Card.Description>For growing teams and projects</Card.Description>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-2 text-sm">
						<li>10 data sources</li>
						<li>50 collections</li>
						<li>10,000 items</li>
						<li>5 consumers</li>
					</ul>
				</Card.Content>
				<Card.Footer>
					<Button onclick={() => handleCheckout("pro_product_id")} class="w-full">
						{data.quota?.subscriptionStatus === "active" ? "Switch to Pro" : "Upgrade to Pro"}
					</Button>
				</Card.Footer>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Enterprise</Card.Title>
					<Card.Description>For large-scale deployments</Card.Description>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-2 text-sm">
						<li>100 data sources</li>
						<li>500 collections</li>
						<li>100,000 items</li>
						<li>50 consumers</li>
					</ul>
				</Card.Content>
				<Card.Footer>
					<Button onclick={() => handleCheckout("enterprise_product_id")} class="w-full">
						{data.quota?.subscriptionStatus === "active" ? "Switch to Enterprise" : "Upgrade to Enterprise"}
					</Button>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Current Usage</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span>Sources</span>
						<span>{data.quota?.sources ?? 0} / {data.quota?.maxSources ?? 1}</span>
					</div>
					<div class="h-2 w-full rounded-full bg-secondary">
						<div
							class="h-2 rounded-full bg-primary"
							style="width: {Math.min(100, ((data.quota?.sources ?? 0) / (data.quota?.maxSources ?? 1)) * 100)}%"
						></div>
					</div>
				</div>
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span>Collections</span>
						<span>{data.quota?.collections ?? 0} / {data.quota?.maxCollections ?? 5}</span>
					</div>
					<div class="h-2 w-full rounded-full bg-secondary">
						<div
							class="h-2 rounded-full bg-primary"
							style="width: {Math.min(100, ((data.quota?.collections ?? 0) / (data.quota?.maxCollections ?? 5)) * 100)}%"
						></div>
					</div>
				</div>
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span>Items</span>
						<span>{data.quota?.items ?? 0} / {data.quota?.maxItems ?? 100}</span>
					</div>
					<div class="h-2 w-full rounded-full bg-secondary">
						<div
							class="h-2 rounded-full bg-primary"
							style="width: {Math.min(100, ((data.quota?.items ?? 0) / (data.quota?.maxItems ?? 100)) * 100)}%"
						></div>
					</div>
				</div>
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span>Consumers</span>
						<span>{data.quota?.consumers ?? 0} / {data.quota?.maxConsumers ?? 1}</span>
					</div>
					<div class="h-2 w-full rounded-full bg-secondary">
						<div
							class="h-2 rounded-full bg-primary"
							style="width: {Math.min(100, ((data.quota?.consumers ?? 0) / (data.quota?.maxConsumers ?? 1)) * 100)}%"
						></div>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
