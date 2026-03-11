<script lang="ts">
  import { untrack } from "svelte";
  import type { CollectionIcon } from "@contfu/core";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { ImageIcon, SmileIcon, XIcon } from "@lucide/svelte";

  interface Props {
    /** Current serialized icon value (JSON string or null/undefined) */
    value?: string | null;
    /** Called when the icon changes; emits JSON string or null to clear */
    onchange?: (value: string | null) => void;
    /** Name for a hidden input (optional, for native form submission) */
    name?: string;
  }

  let { value = null, onchange, name }: Props = $props();

  type Mode = "emoji" | "image";

  function parseValue(v: string | null | undefined): CollectionIcon | null {
    if (!v || v === "null") return null;
    try {
      return JSON.parse(v) as CollectionIcon;
    } catch {
      return null;
    }
  }

  // Use untrack so Svelte doesn't warn about reading `value` (a prop) outside a reactive context.
  // We intentionally snapshot the initial value — edits are managed locally via emojiInput/imageInput.
  const initialParsed = untrack(() => parseValue(value));
  let mode = $state<Mode>(initialParsed?.type === "image" ? "image" : "emoji");
  let emojiInput = $state(initialParsed?.type === "emoji" ? initialParsed.value : "");
  let imageInput = $state(initialParsed?.type === "image" ? initialParsed.url : "");

  function emit() {
    let icon: CollectionIcon | null = null;
    if (mode === "emoji" && emojiInput.trim()) {
      // Take only the first grapheme cluster (one emoji)
      const segments = [...new Intl.Segmenter().segment(emojiInput.trim())];
      icon = { type: "emoji", value: segments[0]?.segment ?? emojiInput.trim() };
    } else if (mode === "image" && imageInput.trim()) {
      icon = { type: "image", url: imageInput.trim() };
    }
    onchange?.(icon ? JSON.stringify(icon) : null);
  }

  function clear() {
    emojiInput = "";
    imageInput = "";
    onchange?.(null);
  }

  const serialized = $derived((() => {
    let icon: CollectionIcon | null = null;
    if (mode === "emoji" && emojiInput.trim()) {
      const segments = [...new Intl.Segmenter().segment(emojiInput.trim())];
      icon = { type: "emoji", value: segments[0]?.segment ?? emojiInput.trim() };
    } else if (mode === "image" && imageInput.trim()) {
      icon = { type: "image", url: imageInput.trim() };
    }
    return icon ? JSON.stringify(icon) : null;
  })());
</script>

<div class="space-y-2">
  <!-- Mode toggle -->
  <div class="flex gap-1 rounded-md border border-input bg-muted p-0.5">
    <button
      type="button"
      class="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors {mode === 'emoji'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => { mode = 'emoji'; emit(); }}
    >
      <SmileIcon class="size-3" />
      Emoji
    </button>
    <button
      type="button"
      class="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors {mode === 'image'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => { mode = 'image'; emit(); }}
    >
      <ImageIcon class="size-3" />
      Image URL
    </button>
  </div>

  <!-- Input -->
  {#if mode === "emoji"}
    <div class="flex gap-2">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-muted text-xl">
        {#if emojiInput.trim()}
          {[...new Intl.Segmenter().segment(emojiInput.trim())][0]?.segment ?? ""}
        {:else}
          <SmileIcon class="size-4 text-muted-foreground" />
        {/if}
      </div>
      <Input
        type="text"
        placeholder="Paste or type an emoji"
        value={emojiInput}
        oninput={(e) => { emojiInput = (e.currentTarget as HTMLInputElement).value; emit(); }}
      />
    </div>
  {:else}
    <div class="flex gap-2">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-muted overflow-hidden">
        {#if imageInput.trim()}
          <img src={imageInput.trim()} alt="" class="h-full w-full object-contain" />
        {:else}
          <ImageIcon class="size-4 text-muted-foreground" />
        {/if}
      </div>
      <Input
        type="url"
        placeholder="https://example.com/icon.png"
        value={imageInput}
        oninput={(e) => { imageInput = (e.currentTarget as HTMLInputElement).value; emit(); }}
      />
    </div>
  {/if}

  <!-- Clear button -->
  {#if serialized}
    <Button type="button" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" onclick={clear}>
      <XIcon class="size-3" />
      Clear icon
    </Button>
  {/if}

  <!-- Hidden input for native form submission -->
  {#if name}
    <input type="hidden" {name} value={serialized ?? ""} />
  {/if}
</div>
