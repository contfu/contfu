<script lang="ts">
  import { createSource, testNewConnection } from "$lib/remote/sources.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import * as Alert from "$lib/components/ui/alert";

  const SOURCE_TYPES = [
    { value: "0", label: "Notion" },
    { value: "1", label: "Strapi" },
    { value: "2", label: "Web" },
  ];

  const AUTH_TYPES = [
    { value: "0", label: "None" },
    { value: "1", label: "Bearer Token" },
    { value: "2", label: "Basic Auth" },
  ];

  let selectedType = $state("1");
  let selectedAuthType = $state("0");
  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);

  const isWebSource = $derived(selectedType === "2");
  const requiresCredentials = $derived(!isWebSource || (isWebSource && selectedAuthType !== "0"));

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
        authType: isWebSource ? Number.parseInt(selectedAuthType, 10) : undefined,
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

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <div class="mb-6">
    <a href="/sources" class="text-sm text-muted-foreground hover:text-foreground">← Sources</a>
  </div>

  <div class="mb-8">
    <h1 class="text-2xl font-semibold tracking-tight">Add Source</h1>
    <p class="mt-1 text-sm text-muted-foreground">Connect a content source to start syncing</p>
  </div>

  <form method="post" action={createSource.action} class="space-y-5">
    <div class="space-y-1.5">
      <Label for="name">Name</Label>
      <Input id="name" name="name" type="text" placeholder="My Content Source" required />
      {#if createSource.fields?.name?.issues()?.length}
        <p class="text-sm text-destructive">{createSource.fields?.name?.issues()?.[0]?.message}</p>
      {/if}
    </div>

    <div class="space-y-1.5">
      <Label for="type">Type</Label>
      <Select.Root type="single" name="type" bind:value={selectedType}>
        <Select.Trigger id="type" class="w-full">
          {SOURCE_TYPES.find((t) => t.value === selectedType)?.label ?? "Select type"}
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

    {#if selectedType === "1" || selectedType === "2"}
      <div class="space-y-1.5">
        <Label for="url">{selectedType === "1" ? "Strapi URL" : "Base URL"}</Label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder={selectedType === "1" ? "https://strapi.example.com" : "https://example.com"}
          required
        />
        {#if createSource.fields?.url?.issues()?.length}
          <p class="text-sm text-destructive">{createSource.fields?.url?.issues()?.[0]?.message}</p>
        {/if}
      </div>
    {/if}

    {#if isWebSource}
      <div class="space-y-1.5">
        <Label for="authType">Authentication</Label>
        <Select.Root type="single" name="authType" bind:value={selectedAuthType}>
          <Select.Trigger id="authType" class="w-full">
            {AUTH_TYPES.find((t) => t.value === selectedAuthType)?.label ?? "Select auth"}
          </Select.Trigger>
          <Select.Content>
            {#each AUTH_TYPES as authType}
              <Select.Item value={authType.value}>{authType.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {/if}

    {#if requiresCredentials}
      <div class="space-y-1.5">
        <Label for="_credentials">
          {#if isWebSource}
            {selectedAuthType === "1" ? "Bearer Token" : "Credentials"}
          {:else}
            API Token
          {/if}
        </Label>
        <Input
          id="_credentials"
          name="_credentials"
          type="password"
          placeholder={
            selectedType === "0"
              ? "secret_..."
              : isWebSource && selectedAuthType === "2"
                ? "username:password"
                : "Enter API token"
          }
          required
        />
        <p class="text-xs text-muted-foreground">
          {#if selectedType === "0"}
            Get your token at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener" class="underline">notion.so/my-integrations</a>
          {:else if isWebSource && selectedAuthType === "2"}
            Format: username:password
          {/if}
        </p>
        {#if createSource.fields?._credentials?.issues()?.length}
          <p class="text-sm text-destructive">{createSource.fields?._credentials?.issues()?.[0]?.message}</p>
        {/if}
      </div>
    {/if}

    {#if testResult}
      <Alert.Root variant={testResult.success ? "default" : "destructive"}>
        <Alert.Title>{testResult.success ? "Connection successful" : "Connection failed"}</Alert.Title>
        <Alert.Description>{testResult.message}</Alert.Description>
      </Alert.Root>
    {/if}

    <div class="flex gap-2 pt-2">
      <Button type="submit" disabled={!!createSource.pending}>
        {createSource.pending ? "Creating..." : "Create Source"}
      </Button>
      <Button type="button" variant="outline" onclick={handleTestConnection} disabled={testPending}>
        {testPending ? "Testing..." : "Test Connection"}
      </Button>
    </div>
  </form>
</div>
