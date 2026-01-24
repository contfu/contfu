<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    getSource,
    updateSource,
    deleteSource,
    testConnection,
  } from "$lib/remote/sources.remote";
  import { getCollectionsBySource } from "$lib/remote/collections.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPE_LABELS: Record<number, string> = {
    0: "Notion",
    1: "Strapi",
  };

  const id = Number.parseInt(page.params.id ?? "", 10);
  const source = Number.isNaN(id) ? null : await getSource({ id });
  const collections = source ? await getCollectionsBySource({ sourceId: id }) : [];

  if (!source) {
    goto("/sources");
  }

  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);
  let updateSuccess = $state(false);

  async function handleTestConnection() {
    if (!source) return;

    testPending = true;
    testResult = null;

    try {
      const result = await testConnection({ id: source.id });
      testResult = result;
    } catch (error) {
      testResult = {
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      };
    } finally {
      testPending = false;
    }
  }

  function handleUpdateSuccess() {
    updateSuccess = true;
    setTimeout(() => {
      updateSuccess = false;
    }, 3000);
  }
</script>

{#if source}
  <div class="container mx-auto max-w-2xl p-6">
    <div class="mb-6">
      <a href="/sources" class="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Sources
      </a>
    </div>

    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>Edit Source</Card.Title>
            <Card.Description>
              Update your {SOURCE_TYPE_LABELS[source.type] ?? "content"} source configuration.
            </Card.Description>
          </div>
          <span
            class="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {SOURCE_TYPE_LABELS[source.type] ?? "Unknown"}
          </span>
        </div>
      </Card.Header>

      <Card.Content>
        <form
          method="post"
          action={updateSource.action}
          class="space-y-6"
          onsubmit={() => {
            if (updateSource.result?.success) {
              handleUpdateSuccess();
            }
          }}
        >
          <input type="hidden" name="id" value={source.id} />

          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="My Content Source"
              value={source.name ?? ""}
            />
            {#if updateSource.fields?.name?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateSource.fields?.name?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          {#if source.type === 1}
            <div class="space-y-2">
              <Label for="url">Strapi URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://strapi.example.com"
                value={source.url ?? ""}
              />
              <p class="text-sm text-muted-foreground">
                The base URL of your Strapi instance.
              </p>
              {#if updateSource.fields?.url?.issues()?.length}
                <p class="text-sm text-destructive">
                  {updateSource.fields?.url?.issues()?.[0]?.message}
                </p>
              {/if}
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="_credentials">API Token</Label>
            <Input
              id="_credentials"
              name="_credentials"
              type="password"
              placeholder="Leave blank to keep current token"
            />
            <p class="text-sm text-muted-foreground">
              Only enter a new token if you want to change it.
            </p>
            {#if updateSource.fields?._credentials?.issues()?.length}
              <p class="text-sm text-destructive">
                {updateSource.fields?._credentials?.issues()?.[0]?.message}
              </p>
            {/if}
          </div>

          <div class="rounded-lg border bg-muted/50 p-4">
            <h3 class="mb-2 text-sm font-medium">Source Information</h3>
            <dl class="space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Collections:</dt>
                <dd class="font-medium">{source.collectionCount}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Created:</dt>
                <dd class="font-medium">
                  {new Date(source.createdAt * 1000).toLocaleString()}
                </dd>
              </div>
              {#if source.updatedAt}
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Last updated:</dt>
                  <dd class="font-medium">
                    {new Date(source.updatedAt * 1000).toLocaleString()}
                  </dd>
                </div>
              {/if}
            </dl>
          </div>

          {#if testResult}
            <Alert.Root variant={testResult.success ? "default" : "destructive"}>
              <Alert.Title>
                {testResult.success ? "Connection successful" : "Connection failed"}
              </Alert.Title>
              <Alert.Description>{testResult.message}</Alert.Description>
            </Alert.Root>
          {/if}

          {#if updateSuccess}
            <Alert.Root>
              <Alert.Title>Source updated</Alert.Title>
              <Alert.Description>Your changes have been saved.</Alert.Description>
            </Alert.Root>
          {/if}

          <div class="flex gap-3">
            <Button type="submit" disabled={!!updateSource.pending}>
              {updateSource.pending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onclick={handleTestConnection}
              disabled={testPending}
            >
              {testPending ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        </form>
      </Card.Content>

      <Card.Footer class="border-t pt-6">
        <div class="flex w-full items-center justify-between">
          <div>
            <h3 class="text-sm font-medium text-destructive">Danger Zone</h3>
            <p class="text-sm text-muted-foreground">
              Deleting this source will also delete all associated collections.
            </p>
          </div>
          <form method="post" action={deleteSource.action}>
            <input type="hidden" name="id" value={source.id} />
            <Button
              variant="destructive"
              type="submit"
              onclick={(e: MouseEvent) => {
                if (
                  !confirm(
                    `Are you sure you want to delete "${source.name || "this source"}"? This action cannot be undone.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Delete Source
            </Button>
          </form>
        </div>
      </Card.Footer>
    </Card.Root>

    <!-- Collections Section -->
    <section class="mt-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Collections</h2>
        <Button size="sm" href="/sources/{id}/collections/new">Add Collection</Button>
      </div>

      {#if collections.length === 0}
        <Alert.Root>
          <Alert.Title>No collections</Alert.Title>
          <Alert.Description>
            <a href="/sources/{id}/collections/new" class="underline">Add your first collection</a> to
            start syncing content from this source.
          </Alert.Description>
        </Alert.Root>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2">
          {#each collections as collection}
            <Card.Root class="flex flex-col">
              <Card.Header class="pb-2">
                <Card.Title class="text-base">{collection.name || "Unnamed Collection"}</Card.Title>
              </Card.Header>

              <Card.Content class="flex-1">
                <div class="space-y-1 text-sm text-muted-foreground">
                  <div class="flex items-center justify-between">
                    <span>Connected clients:</span>
                    <span class="font-medium text-foreground">{collection.connectionCount}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Created:</span>
                    <span class="font-medium text-foreground">
                      {new Date(collection.createdAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card.Content>

              <Card.Footer class="pt-2">
                <Button variant="outline" size="sm" href="/sources/{id}/collections/{collection.id}">
                  Manage
                </Button>
              </Card.Footer>
            </Card.Root>
          {/each}
        </div>

        <div class="mt-4">
          <Button variant="link" href="/sources/{id}/collections" class="px-0">
            View all collections &rarr;
          </Button>
        </div>
      {/if}
    </section>
  </div>
{:else}
  <div class="container mx-auto max-w-2xl p-6">
    <Alert.Root variant="destructive">
      <Alert.Title>Source not found</Alert.Title>
      <Alert.Description>
        The source you're looking for doesn't exist or you don't have access to it.
      </Alert.Description>
    </Alert.Root>
    <div class="mt-4">
      <Button href="/sources">Back to Sources</Button>
    </div>
  </div>
{/if}
