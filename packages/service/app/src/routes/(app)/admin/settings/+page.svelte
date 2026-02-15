<script lang="ts">
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { getSystemSettings } from "$lib/remote/admin.remote";
  import { SettingsIcon } from "@lucide/svelte";

  const settings = await getSystemSettings();
</script>

<svelte:head>
  <title>Settings - Contfu Admin</title>
</svelte:head>

<SiteHeader icon={SettingsIcon} title="System Settings" />

<div class="p-6">
  <p class="mb-6 text-sm text-muted-foreground">
    Manage system-wide configuration
  </p>

  <div class="space-y-6">
    <div class="rounded-lg border border-border p-4">
      <h2 class="mb-2 text-lg font-medium">Notion OAuth Verification Token</h2>
      <p class="text-muted-foreground mb-3 text-sm">
        This token is set automatically when Notion sends a verification webhook to the OAuth endpoint.
        Copy it and paste it back into Notion's webhook verification UI to complete the setup.
      </p>
      {#if settings.notionOAuthVerificationToken}
        <div class="flex items-center gap-2">
          <code class="bg-muted rounded px-3 py-2 text-sm break-all">
            {settings.notionOAuthVerificationToken}
          </code>
        </div>
      {:else}
        <p class="text-muted-foreground text-sm italic">
          No verification token stored. Send a webhook to the OAuth endpoint to generate one.
        </p>
      {/if}
    </div>
  </div>
</div>
