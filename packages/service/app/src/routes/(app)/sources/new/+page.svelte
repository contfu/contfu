<script lang="ts">
  import { createSource, testNewConnection } from "$lib/remote/sources.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import * as Card from "$lib/components/ui/card";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPES = [
    { value: "0", label: "Notion" },
    { value: "1", label: "Strapi" },
  ];

  let selectedType = $state("1"); // Default to Strapi
  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);

  async function handleTestConnection() {
    testPending = true;
    testResult = null;

    const urlInput = document.querySelector<HTMLInputElement>('input[name="url"]');
    const credentialsInput = document.querySelector<HTMLInputElement>('input[name="_credentials"]');

    try {
      const result = await testNewConnection({
        type: Number.parseInt(selectedType, 10),
        url: urlInput?.value || undefined,
        _credentials: credentialsInput?.value ?? "",
      });
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
</script>

<div class="container mx-auto max-w-2xl p-6">
  <div class="mb-6">
    <a href="/sources" class="text-sm text-muted-foreground hover:text-foreground">
      &larr; Back to Sources
    </a>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Add New Source</Card.Title>
      <Card.Description>
        Connect a content source to start syncing data.
      </Card.Description>
    </Card.Header>

    <Card.Content>
      <form method="post" action={createSource.action} class="space-y-6">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="My Content Source"
            required
          />
          {#if createSource.fields?.name?.issues()?.length}
            <p class="text-sm text-destructive">{createSource.fields?.name?.issues()?.[0]?.message}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="type">Source Type</Label>
          <Select.Root type="single" name="type" bind:value={selectedType}>
            <Select.Trigger id="type" class="w-full" aria-label="Source Type">
              {SOURCE_TYPES.find((t) => t.value === selectedType)?.label ?? "Select a type"}
            </Select.Trigger>
            <Select.Content>
              {#each SOURCE_TYPES as type}
                <Select.Item value={type.value}>{type.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          {#if createSource.fields?.type?.issues()?.length}
            <p class="text-sm text-destructive">{createSource.fields?.type?.issues()?.[0]?.message}</p>
          {/if}
        </div>

        {#if selectedType === "1"}
          <div class="space-y-2">
            <Label for="url">Strapi URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://strapi.example.com"
              required
            />
            <p class="text-sm text-muted-foreground">
              The base URL of your Strapi instance.
            </p>
            {#if createSource.fields?.url?.issues()?.length}
              <p class="text-sm text-destructive">{createSource.fields?.url?.issues()?.[0]?.message}</p>
            {/if}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="_credentials">API Token</Label>
          <Input
            id="_credentials"
            name="_credentials"
            type="password"
            placeholder={selectedType === "0" ? "secret_..." : "Enter API token"}
            required
          />
          <p class="text-sm text-muted-foreground">
            {#if selectedType === "0"}
              Your Notion integration token. Create one at
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener"
                class="underline"
              >
                notion.so/my-integrations
              </a>.
            {:else}
              A Strapi API token with read access to your content types.
            {/if}
          </p>
          {#if createSource.fields?._credentials?.issues()?.length}
            <p class="text-sm text-destructive">
              {createSource.fields?._credentials?.issues()?.[0]?.message}
            </p>
          {/if}
        </div>

        {#if testResult}
          <Alert.Root variant={testResult.success ? "default" : "destructive"}>
            <Alert.Title>{testResult.success ? "Connection successful" : "Connection failed"}</Alert.Title>
            <Alert.Description>{testResult.message}</Alert.Description>
          </Alert.Root>
        {/if}

        <div class="flex gap-3">
          <Button type="submit" disabled={!!createSource.pending}>
            {createSource.pending ? "Creating..." : "Create Source"}
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
  </Card.Root>
</div>
