<script lang="ts">
	import { getSources } from "$lib/remote/sources.remote";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import * as Alert from "$lib/components/ui/alert";

	const sources = await getSources();

	const SOURCE_TYPE_LABELS: Record<number, string> = {
		0: "Notion",
		1: "Strapi"
	};
</script>

<div class="container mx-auto max-w-5xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Dashboard</h1>
	</div>

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
</div>
