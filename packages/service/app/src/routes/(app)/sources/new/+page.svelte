<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select, Switch } from "@contfu/ui";
  import { SOURCE_TYPE_LABELS } from "$lib/domain/source";
  import { listIntegrations } from "$lib/remote/integrations.remote";
  import {
    createNotionSourceFromOAuth,
    createSource,
    testNewConnection,
  } from "$lib/remote/sources.remote";
  import {
    clearFormState,
    persistFormState,
    restoreFormState,
  } from "$lib/utils/formState";
  import { tcToast } from "$lib/utils/toast";
  import { SourceType } from "@contfu/core";
  import { WebAuthType } from "@contfu/svc-core";
  import { useId } from "bits-ui";

  import { toast } from "svelte-sonner";

  const nameId = useId();
  const typeId = useId();
  const urlId = useId();
  const authTypeId = useId();
  const credentialsId = useId();

  const SOURCE_TYPES = [
    { value: SourceType.NOTION, label: SOURCE_TYPE_LABELS[SourceType.NOTION] },
    { value: SourceType.STRAPI, label: SOURCE_TYPE_LABELS[SourceType.STRAPI] },
    { value: SourceType.WEB, label: SOURCE_TYPE_LABELS[SourceType.WEB] },
  ];

  const AUTH_TYPES = [
    { value: WebAuthType.NONE, label: "None" },
    { value: WebAuthType.BEARER, label: "Bearer Token" },
    { value: WebAuthType.BASIC, label: "Basic Auth" },
  ];

  let selectedType = $state<SourceType>(SourceType.WEB);
  let selectedAuthType = $state<WebAuthType>(WebAuthType.NONE);

  let testResult: { success: boolean; message: string } | null = $state(null);
  let testPending = $state(false);
  let includeRef = $state(true);
  let useOAuth = $state(true);
  let oauthPending = $state(false);
  let oauthError = $state<string | null>(null);
  let selectedIntegrationId = $state<string | null>(null);

  const isNotionSource = $derived(selectedType === SourceType.NOTION);
  const isWebSource = $derived(selectedType === SourceType.WEB);
  const requiresCredentials = $derived(
    (isNotionSource && !useOAuth) ||
      (!isNotionSource && !isWebSource) ||
      (isWebSource && selectedAuthType !== WebAuthType.NONE),
  );

  // Load integrations when Notion is selected
  let notionIntegrations = $state<
    { id: string; label: string; providerId: string }[]
  >([]);
  let integrationsLoaded = $state(false);

  $effect(() => {
    if (isNotionSource) {
      loadNotionIntegrations();
    }
  });

  // Restore form state after OAuth redirect
  $effect(() => {
    const params = page.url?.searchParams;
    if (params?.get("type") === "notion" && params?.get("linked") === "1") {
      const restored = restoreFormState();
      if (restored) {
        selectedType = restored.selectedType;
        selectedAuthType = restored.selectedAuthType;
        useOAuth = restored.useOAuth;
        includeRef = restored.includeRef;

        const nameInput =
          document.querySelector<HTMLInputElement>('input[name="name"]');
        if (nameInput && restored.name) {
          nameInput.value = restored.name;
        }

        if (restored.url) {
          const urlInput =
            document.querySelector<HTMLInputElement>('input[name="url"]');
          if (urlInput) {
            urlInput.value = restored.url;
          }
        }

        if (restored._credentials) {
          const credentialsInput = document.querySelector<HTMLInputElement>(
            'input[name="_credentials"]',
          );
          if (credentialsInput) {
            credentialsInput.value = restored._credentials;
          }
        }

        // Reload integrations after OAuth redirect
        loadNotionIntegrations();
      }
    }
  });

  async function loadNotionIntegrations() {
    try {
      const integrations = await listIntegrations();
      notionIntegrations = integrations.filter(
        (i) => i.providerId === "notion",
      );
      integrationsLoaded = true;
      // Auto-select first if available
      if (notionIntegrations.length > 0 && !selectedIntegrationId) {
        selectedIntegrationId = notionIntegrations[0].id;
      }
    } catch {
      notionIntegrations = [];
      integrationsLoaded = true;
    }
  }

  async function handleConnectNotion() {
    oauthPending = true;
    oauthError = null;

    const nameInput =
      document.querySelector<HTMLInputElement>('input[name="name"]');
    const urlInput =
      document.querySelector<HTMLInputElement>('input[name="url"]');
    const credentialsInput = document.querySelector<HTMLInputElement>(
      'input[name="_credentials"]',
    );

    persistFormState({
      name: nameInput?.value || "",
      selectedType,
      selectedAuthType,
      useOAuth,
      includeRef,
      url: urlInput?.value || undefined,
      _credentials: credentialsInput?.value || undefined,
    });

    try {
      await authClient.linkSocial({
        provider: "notion",
        callbackURL: "/sources/new?type=notion&linked=1",
      });
    } catch (error) {
      oauthError =
        error instanceof Error ? error.message : "Failed to connect Notion";
    } finally {
      oauthPending = false;
    }
  }

  async function handleCreateNotionSource() {
    oauthPending = true;
    oauthError = null;
    const nameInput =
      document.querySelector<HTMLInputElement>('input[name="name"]');
    const name = nameInput?.value?.trim();

    if (!name) {
      oauthError = "Name is required";
      oauthPending = false;
      return;
    }

    if (!selectedIntegrationId) {
      oauthError = "Please select an integration";
      oauthPending = false;
      return;
    }

    try {
      const result = await createNotionSourceFromOAuth({
        name,
        integrationId: selectedIntegrationId,
        includeRef,
      });
      if ("error" in result) {
        oauthError = result.error as string;
      } else {
        clearFormState();
        goto(`/sources/${result.id}`);
      }
    } catch (error) {
      oauthError =
        error instanceof Error ? error.message : "Failed to create source";
    } finally {
      oauthPending = false;
    }
  }

  async function handleTestConnection() {
    testPending = true;
    testResult = null;

    const urlInput =
      document.querySelector<HTMLInputElement>('input[name="url"]');
    const credentialsInput = document.querySelector<HTMLInputElement>(
      'input[name="_credentials"]',
    );

    try {
      const result = await testNewConnection({
        type: selectedType,
        url: urlInput?.value || undefined,
        _credentials: credentialsInput?.value ?? "",
        authType: isWebSource ? selectedAuthType : undefined,
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

<SiteHeader title="add source">
  <a
    href="/sources"
    class="ml-auto text-xs text-muted-foreground hover:text-foreground"
  >
    &lt; sources
  </a>
</SiteHeader>

<div class="page-shell px-4 py-8 sm:px-6">
  <p class="mb-8 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu sources create
  </p>

  <form
    {...createSource.enhance(async ({ submit }) => {
      await tcToast(async () => {
        await submit();
        toast.success("Source created");
      });
    })}
    class="space-y-5"
    onsubmit={(e) => {
      if (isNotionSource && useOAuth) {
        e.preventDefault();
        void handleCreateNotionSource();
      }
    }}
  >
    <div class="space-y-1.5">
      <Label for={nameId}>Name</Label>
      <Input id={nameId} name="name" placeholder="My Content Source" required />
      {#if createSource.fields?.name?.issues()?.[0]?.message}
        <p class="text-sm text-destructive">
          {createSource.fields?.name?.issues()?.[0]?.message}
        </p>
      {/if}
    </div>

    <div class="space-y-1.5">
      <Label for={typeId}>Type</Label>
      <Select
        id={typeId}
        name="type"
        class="w-full"
        bind:value={
          () => selectedType.toString(),
          (v) => (selectedType = Number(v) as SourceType)
        }
        options={SOURCE_TYPES.map((t) => ({
          value: t.value.toString(),
          label: t.label,
        }))}
      />
      <!-- validation errors handled server-side -->
      <p class="text-sm text-destructive">
        {createSource.fields?.type?.issues()?.[0]?.message}
      </p>
    </div>

    <div
      class="flex items-center justify-between rounded-md border border-border px-3 py-2"
    >
      <Label for="source-include-ref">Forward source item references</Label>
      <Switch
        id="source-include-ref"
        {...createSource.fields.includeRef.as("checkbox")}
      />
    </div>

    {#if isNotionSource}
      <div class="space-y-3">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              bind:group={useOAuth}
              value={true}
              class="accent-primary"
            />
            <span class="text-sm">Connect with Notion (recommended)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              bind:group={useOAuth}
              value={false}
              class="accent-primary"
            />
            <span class="text-sm">Use API token</span>
          </label>
        </div>

        {#if useOAuth}
          <div class="rounded-lg border bg-muted/50 p-4">
            {#if !integrationsLoaded}
              <p class="text-sm text-muted-foreground">
                Loading integrations...
              </p>
            {:else if notionIntegrations.length > 0}
              <div class="space-y-2">
                <Label>Notion Integration</Label>
                <Select
                  class="w-full"
                  bind:value={
                    () => selectedIntegrationId ?? "",
                    (v) => (selectedIntegrationId = v || null)
                  }
                  options={notionIntegrations.map((i) => ({
                    value: i.id,
                    label: i.label,
                  }))}
                />
              </div>
              <p class="mt-2 text-xs text-muted-foreground">
                Or <button
                  type="button"
                  class="underline hover:text-foreground"
                  onclick={handleConnectNotion}
                  disabled={oauthPending}
                >connect a new Notion account</button>.
              </p>
            {:else}
              <p class="text-sm text-muted-foreground mb-3">
                Connect your Notion workspace to sync databases and pages.
              </p>
              <Button
                type="button"
                variant="outline"
                onclick={handleConnectNotion}
                disabled={oauthPending}
              >
                {oauthPending ? "Connecting..." : "Connect Notion"}
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if selectedType === SourceType.STRAPI || selectedType === SourceType.WEB}
      <div class="space-y-1.5">
        <Label for={urlId}
          >{selectedType === SourceType.STRAPI
            ? "Strapi URL"
            : "Base URL"}</Label
        >
        <Input
          id={urlId}
          {...createSource.fields?.url.as("url")}
          placeholder={selectedType === SourceType.STRAPI
            ? "https://strapi.example.com"
            : "https://example.com"}
          required
        />
      </div>
    {/if}

    {#if isWebSource}
      <div class="space-y-1.5">
        <Label for={authTypeId}>Authentication</Label>
        <Select
          id={authTypeId}
          name="authType"
          class="w-full"
          bind:value={
            () => selectedAuthType.toString(),
            (v) => (selectedAuthType = Number(v) as WebAuthType)
          }
          options={AUTH_TYPES.map((t) => ({
            value: t.value.toString(),
            label: t.label,
          }))}
        />
      </div>
    {/if}

    {#if requiresCredentials}
      <div class="space-y-1.5">
        <Label for={credentialsId}>
          {#if isWebSource}
            {selectedAuthType === WebAuthType.BEARER
              ? "Bearer Token"
              : "Credentials"}
          {:else if isNotionSource}
            Notion API Token
          {:else}
            API Token
          {/if}
        </Label>
        <Input
          id={credentialsId}
          {...createSource.fields?._credentials.as("password")}
          placeholder={isNotionSource
            ? "secret_..."
            : isWebSource && selectedAuthType === WebAuthType.BASIC
              ? "username:password"
              : "Enter API token"}
          required
        />
        <p class="text-xs text-muted-foreground">
          {#if isNotionSource}
            Get your token at <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener"
              class="underline">notion.so/my-integrations</a
            >
          {:else if isWebSource && selectedAuthType === WebAuthType.BASIC}
            Format: username:password
          {/if}
        </p>
      </div>
    {/if}

    {#if testResult}
      <Alert.Root variant={testResult.success ? "default" : "destructive"}>
        <Alert.Title
          >{testResult.success
            ? "Connection successful"
            : "Connection failed"}</Alert.Title
        >
        <Alert.Description>{testResult.message}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if oauthError}
      <Alert.Root variant="destructive">
        <Alert.Title>Error</Alert.Title>
        <Alert.Description>{oauthError}</Alert.Description>
      </Alert.Root>
    {/if}

    <div class="flex gap-2 pt-2">
      {#if isNotionSource && useOAuth}
        <Button
          type="button"
          onclick={handleCreateNotionSource}
          disabled={oauthPending || !selectedIntegrationId}
        >
          {oauthPending ? "Creating..." : "Create Source"}
        </Button>
      {:else}
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
      {/if}
    </div>
  </form>
</div>
