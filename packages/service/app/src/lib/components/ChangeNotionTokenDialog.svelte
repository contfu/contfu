<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { updateSource } from "$lib/remote/sources.remote";
  import { RefreshCcwDotIcon } from "@lucide/svelte";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import { isHttpError } from "@sveltejs/kit";

  interface Props {
    sourceId: string;
    onsuccess?: () => void;
  }

  let { sourceId, onsuccess }: Props = $props();

  let open = $state(false);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let tokenValue = $state("");

  // Create a separate form instance keyed by sourceId to avoid the
  // "form attached to multiple instances" conflict with the Connection
  // section form on the same page (both use updateSource).
  const dialogForm = updateSource.for(sourceId);

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      tokenValue = "";
      submitError = null;
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <Button variant="destructive" size="sm"
      ><RefreshCcwDotIcon class="h-4 w-4" /> Change Token</Button
    >
  </Dialog.Trigger>

  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Change Notion API Token</Dialog.Title>
      <Dialog.Description>
        Replace the current Notion integration token.
      </Dialog.Description>
    </Dialog.Header>

    <form
      {...dialogForm.enhance(async ({ submit }) => {
        submitting = true;
        submitError = null;
        try {
          await submit();
          open = false;
          onsuccess?.();
        } catch (err) {
          submitError = isHttpError(err)
            ? err.body.message
            : "Failed to update token";
        } finally {
          submitting = false;
        }
      })}
      class="space-y-4"
    >
      <input type="hidden" name="id" value={sourceId} />

      <ul class="space-y-1.5 text-sm text-muted-foreground">
        <li class="flex items-start gap-2">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          This will replace the current Notion integration connection.
        </li>
        <li class="flex items-start gap-2">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          Existing synced content may become inaccessible if the new token lacks
          permissions.
        </li>
        <li class="flex items-start gap-2">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          The source will need to re-sync after the change.
        </li>
      </ul>

      <div class="space-y-1.5">
        <label for="notion-new-token" class="text-sm font-medium"
          >New API Token</label
        >
        <Input
          id="notion-new-token"
          name="_credentials"
          type="password"
          placeholder="secret_..."
          bind:value={tokenValue}
          disabled={submitting}
        />
      </div>

      {#if submitError}
        <div
          class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle class="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      {/if}

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={() => (open = false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={!tokenValue || submitting}
        >
          {#if submitting}
            Changing...
          {:else}
            Change Token
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
