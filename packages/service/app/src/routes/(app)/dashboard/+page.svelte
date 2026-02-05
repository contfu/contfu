<script lang="ts">
	import { getSources } from "$lib/remote/sources.remote";
	import { getCollections } from "$lib/remote/collections.remote";
	import { getConsumers } from "$lib/remote/consumers.remote";
	import { getConnections } from "$lib/remote/connections.remote";
	import { Button } from "$lib/components/ui/button";
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
		1: "Strapi",
		2: "Web"
	};
</script>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
	<div class="mb-8">
		<h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
		<p class="mt-1 text-sm text-muted-foreground">Overview of your content sync status</p>
	</div>

	{#if hasLoadErrors}
		<Alert.Root class="mb-6" variant="destructive">
			<Alert.Title>Some data failed to load</Alert.Title>
			<Alert.Description>
				Parts of the dashboard are unavailable. Try refreshing the page.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Stats row -->
	<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
		<div class="rounded-lg border border-border p-4">
			<div class="text-2xl font-semibold">{sources.length}</div>
			<div class="text-sm text-muted-foreground">Sources</div>
		</div>
		<div class="rounded-lg border border-border p-4">
			<div class="text-2xl font-semibold">{collections.length}</div>
			<div class="text-sm text-muted-foreground">Collections</div>
		</div>
		<div class="rounded-lg border border-border p-4">
			<div class="text-2xl font-semibold">{consumers.length}</div>
			<div class="text-sm text-muted-foreground">Clients</div>
		</div>
		<div class="rounded-lg border border-border p-4">
			<div class="text-2xl font-semibold">{connections.length}</div>
			<div class="text-sm text-muted-foreground">Connections</div>
		</div>
	</div>

	<!-- Sources section -->
	<section class="mb-8">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Sources</h2>
			<Button size="sm" href="/sources/new">Add Source</Button>
		</div>

		{#if sources.length === 0}
			<div class="rounded-lg border border-dashed border-border p-8 text-center">
				<p class="text-sm text-muted-foreground">No sources configured</p>
				<Button variant="link" href="/sources/new" class="mt-2">Add your first source →</Button>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border border-border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
							<th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground">Collections</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each sources.slice(0, 5) as source}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<a href="/sources/{source.id}" class="font-medium hover:underline">
										{source.name || "Unnamed"}
									</a>
								</td>
								<td class="px-4 py-3 text-muted-foreground">
									{SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
								</td>
								<td class="px-4 py-3 text-right font-mono text-muted-foreground">
									{source.collectionCount}
								</td>
								<td class="px-4 py-3 text-right">
									<a href="/sources/{source.id}" class="text-primary hover:underline">Edit</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if sources.length > 5}
				<div class="mt-2">
					<Button variant="link" href="/sources" class="h-auto p-0 text-sm">View all {sources.length} sources →</Button>
				</div>
			{/if}
		{/if}
	</section>

	<!-- Collections section -->
	<section class="mb-8">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Collections</h2>
			<Button size="sm" href="/collections/new">New Collection</Button>
		</div>

		{#if collections.length === 0}
			<div class="rounded-lg border border-dashed border-border p-8 text-center">
				<p class="text-sm text-muted-foreground">No collections yet</p>
				<Button variant="link" href="/collections/new" class="mt-2">Create your first collection →</Button>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border border-border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground">Sources</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground">Clients</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each collections.slice(0, 5) as collection}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<a href="/collections/{collection.id}" class="font-medium hover:underline">
										{collection.name || "Unnamed"}
									</a>
								</td>
								<td class="px-4 py-3 text-right font-mono text-muted-foreground">
									{collection.influxCount}
								</td>
								<td class="px-4 py-3 text-right font-mono text-muted-foreground">
									{collection.connectionCount}
								</td>
								<td class="px-4 py-3 text-right">
									<a href="/collections/{collection.id}" class="text-primary hover:underline">Edit</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if collections.length > 5}
				<div class="mt-2">
					<Button variant="link" href="/collections" class="h-auto p-0 text-sm">View all {collections.length} collections →</Button>
				</div>
			{/if}
		{/if}
	</section>

	<!-- Clients section -->
	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Clients</h2>
			<Button size="sm" href="/clients/new">Add Client</Button>
		</div>

		{#if consumers.length === 0}
			<div class="rounded-lg border border-dashed border-border p-8 text-center">
				<p class="text-sm text-muted-foreground">No clients configured</p>
				<Button variant="link" href="/clients/new" class="mt-2">Add your first client →</Button>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border border-border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground">Connections</th>
							<th class="px-4 py-2.5 text-right font-medium text-muted-foreground"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each consumers.slice(0, 5) as client}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<a href="/clients/{client.id}" class="font-medium hover:underline">
										{client.name || "Unnamed"}
									</a>
								</td>
								<td class="px-4 py-3 text-right font-mono text-muted-foreground">
									{client.connectionCount}
								</td>
								<td class="px-4 py-3 text-right">
									<a href="/clients/{client.id}" class="text-primary hover:underline">Edit</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if consumers.length > 5}
				<div class="mt-2">
					<Button variant="link" href="/clients" class="h-auto p-0 text-sm">View all {consumers.length} clients →</Button>
				</div>
			{/if}
		{/if}
	</section>
</div>
