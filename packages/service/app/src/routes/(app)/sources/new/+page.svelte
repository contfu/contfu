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
  import { listLinkedAccounts } from "$lib/remote/accounts.remote";
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
  let notionLinked = $state<boolean | null>(null);
  let oauthPending = $state(false);
  let oauthError = $state<string | null>(null);

  const isNotionSource = $derived(selectedType === SourceType.NOTION);
  const isWebSource = $derived(selectedType === SourceType.WEB);
  const requiresCredentials = $derived(
    (isNotionSource && !useOAuth) ||
      (!isNotionSource && !isWebSource) ||
      (isWebSource && selectedAuthType !== WebAuthType.NONE),
  );

  // Check if Notion is linked when component mounts or when Notion is selected
  $effect(() => {
    if (isNotionSource) {
      checkNotionLinked();
    }
  });

  // Restore form state after OAuth redirect
  $effect(() => {
    const params = page.url?.searchParams;
    if (params?.get("type") === "notion" && params?.get("linked") === "1") {
      // Restore persisted form state
      const restored = restoreFormState();
      if (restored) {
        // Restore state variables
        selectedType = restored.selectedType;
        selectedAuthType = restored.selectedAuthType;
        useOAuth = restored.useOAuth;
        includeRef = restored.includeRef;

        // Restore name input value
        const nameInput =
          document.querySelector<HTMLInputElement>('input[name="name"]');
        if (nameInput && restored.name) {
          nameInput.value = restored.name;
        }

        // Restore url input if present
        if (restored.url) {
          const urlInput =
            document.querySelector<HTMLInputElement>('input[name="url"]');
          if (urlInput) {
            urlInput.value = restored.url;
          }
        }

        // Restore credentials if present
        if (restored._credentials) {
          const credentialsInput = document.querySelector<HTMLInputElement>(
            'input[name="_credentials"]',
          );
          if (credentialsInput) {
            credentialsInput.value = restored._credentials;
          }
        }

        // Update Notion linked status
        notionLinked = true;
      }
    }
  });

  async function checkNotionLinked() {
    try {
      const accounts = await listLinkedAccounts();
      notionLinked = accounts.some(
        (a) => a.providerId === "notion" && a.hasAccessToken,
      );
    } catch {
      notionLinked = false;
    }
  }

  async function handleConnectNotion() {
    oauthPending = true;
    oauthError = null;

    // Persist form state before OAuth redirect
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

    try {
      const result = await createNotionSourceFromOAuth({ name, includeRef });
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

<SiteHeader title="Add Source">
  <a
    href="/sources"
    class="ml-auto text-sm text-muted-foreground hover:text-foreground"
  >
    ← Sources
  </a>
</SiteHeader>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
  <p class="mb-8 text-sm text-muted-foreground">
    Connect a content source to start syncing
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
            {#if notionLinked === null}
              <p class="text-sm text-muted-foreground">
                Checking Notion connection...
              </p>
            {:else if notionLinked}
              <div class="flex items-center gap-2 text-sm text-green-600">
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Notion connected! Your workspace access will be used.
              </div>
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
          disabled={oauthPending || !notionLinked}
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
