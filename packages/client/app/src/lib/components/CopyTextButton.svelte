<script lang="ts">
  import { Button } from "$lib/components/ui/button";

  type Props = {
    label: string;
    copiedLabel?: string;
    failedLabel?: string;
    text?: string;
    getText?: () => string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
    disabled?: boolean;
    class?: string;
  };

  let {
    label,
    copiedLabel = "Copied",
    failedLabel = "Copy failed",
    text,
    getText,
    variant = "outline",
    size = "sm",
    disabled = false,
    class: className,
  }: Props = $props();

  let state = $state<"idle" | "copied" | "failed">("idle");
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function resetLater() {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => {
      state = "idle";
      resetTimer = null;
    }, 1500);
  }

  async function copyText() {
    if (disabled) return;

    const value = getText ? getText() : text;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      state = "copied";
    } catch {
      state = "failed";
    }

    resetLater();
  }
</script>

<Button {variant} {size} {disabled} class={className} onclick={copyText}>
  {#if state === "copied"}
    {copiedLabel}
  {:else if state === "failed"}
    {failedLabel}
  {:else}
    {label}
  {/if}
</Button>
