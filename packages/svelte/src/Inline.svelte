<script lang="ts">
  import {
    isAnchor,
    isSafeRichContentUrl,
    isMonospace,
    isBold,
    isItalic,
    isString,
    type Inline,
  } from "@contfu/core";

  let { inline }: { inline: Inline } = $props();
</script>

{#if isString(inline)}
  {inline}
{:else if isAnchor(inline)}
  {#if isSafeRichContentUrl(inline[2])}
    <a href={inline[2]}>{inline[1]}</a>
  {:else}
    {inline[1]}
  {/if}
{:else if isMonospace(inline)}
  <code>{inline[1]}</code>
{:else if isBold(inline)}
  <strong>{inline[1]}</strong>
{:else if isItalic(inline)}
  <em>{inline[1]}</em>
{/if}
