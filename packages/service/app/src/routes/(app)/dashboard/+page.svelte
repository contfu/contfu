<script lang="ts">
	import { getSources } from "$lib/remote/sources.remote";
	import { getCollections } from "$lib/remote/collections.remote";
	import { getConsumers } from "$lib/remote/consumers.remote";
	import { getConnections } from "$lib/remote/connections.remote";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import * as Alert from "$lib/components/ui/alert";

	const results = await Promise.allSettled([
		getSources(),
		getCollections(),
		getConsumers(),
		getConnections()
	]);

	const [sourcesResult, collectionsResult, consumersResult, connectionsResult] = results;
	const sources = sourcesResult.status === "fulfilled" ? sourcesResult.value : [];
	const collections = collectionsResult.status === "fulfilled" ? collectionsResult.value : [];
	const consumers = consumersResult.status === "fulfilled" ? consumersResult.value : [];
	const connections = connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
	const hasLoadErrors = results.some((result) => result.status === "rejected");

	const SOURCE_TYPE_LABELS: Record<number, string> = {
		0: "Notion",
		1: "Strapi"
	};
</script>

<div class="container mx-auto max-w-5xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Dashboard</h1>
	</div>

	{#if hasLoadErrors}
		<Alert.Root class="mb-6" variant="destructive">
			<Alert.Title>Some data failed to load</Alert.Title>
			<Alert.Description>
				Parts of the dashboard are unavailable right now. Try refreshing the page.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Sync Overview Section -->
	<section class="mb-8">
		<h2 class="mb-4 text-lg font-semibold">Sync Overview</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Total Sources</Card.Description>
					<Card.Title class="text-3xl">{sources.length}</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-xs text-muted-foreground">
						{sources.length === 1 ? "1 connected CMS" : `${sources.length} connected CMSs`}
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Total Collections</Card.Description>
					<Card.Title class="text-3xl">{collections.length}</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-xs text-muted-foreground">
						{collections.length === 1 ? "1 content collection" : `${collections.length} content collections`}
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Total Clients</Card.Description>
					<Card.Title class="text-3xl">{consumers.length}</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-xs text-muted-foreground">
						{consumers.length === 1 ? "1 API key" : `${consumers.length} API keys`}
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Active Connections</Card.Description>
					<Card.Title class="text-3xl">{connections.length}</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-xs text-muted-foreground">
						{connections.length === 1 ? "1 client-collection link" : `${connections.length} client-collection links`}
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	</section>

	<!-- Sources Section -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Sources</h2>
			<Button size="sm" href="/sources/new">Add Source</Button>
		</div>

		{#if sources.length === 0}
			<Alert.Root>
				<Alert.Title>No sources configured</Alert.Title>
				<Alert.Description>
					<a href="/sources/new" class="underline">Add your first content source</a> to start syncing
					data from Notion or Strapi.
				</Alert.Description>
			</Alert.Root>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each sources as source}
					<Card.Root class="flex flex-col">
						<Card.Header class="pb-2">
							<div class="flex items-center justify-between">
								<Card.Title class="text-base">{source.name || "Unnamed Source"}</Card.Title>
								<span
									class="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
								>
									{SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
								</span>
							</div>
						</Card.Header>

						<Card.Content class="flex-1">
							<div class="space-y-1 text-sm text-muted-foreground">
								<div class="flex items-center justify-between">
									<span>Collections:</span>
									<span class="font-medium text-foreground">{source.collectionCount}</span>
								</div>
							</div>
						</Card.Content>

						<Card.Footer class="pt-2">
							<Button variant="outline" size="sm" href="/sources/{source.id}">Manage</Button>
						</Card.Footer>
					</Card.Root>
				{/each}
			</div>

			<div class="mt-4">
				<Button variant="link" href="/sources" class="px-0">View all sources &rarr;</Button>
			</div>
		{/if}
	</section>

	<!-- Clients Section -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Clients</h2>
			<Button size="sm" href="/clients/new">Add Client</Button>
		</div>

		{#if consumers.length === 0}
			<Alert.Root>
				<Alert.Title>No clients configured</Alert.Title>
				<Alert.Description>
					<a href="/clients/new" class="underline">Add your first client</a> to generate an API key
					for accessing synced content.
				</Alert.Description>
			</Alert.Root>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each consumers as client}
					<Card.Root class="flex flex-col">
						<Card.Header class="pb-2">
							<Card.Title class="text-base">{client.name || "Unnamed Client"}</Card.Title>
						</Card.Header>

						<Card.Content class="flex-1">
							<div class="space-y-1 text-sm text-muted-foreground">
								<div class="flex items-center justify-between">
									<span>Connections:</span>
									<span class="font-medium text-foreground">{client.connectionCount}</span>
								</div>
							</div>
						</Card.Content>

						<Card.Footer class="pt-2">
							<Button variant="outline" size="sm" href="/clients/{client.id}">Manage</Button>
						</Card.Footer>
					</Card.Root>
				{/each}
			</div>

			<div class="mt-4">
				<Button variant="link" href="/clients" class="px-0">View all clients &rarr;</Button>
			</div>
		{/if}
	</section>
</div>
