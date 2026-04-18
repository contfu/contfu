<script lang="ts">
  import { setContext } from "svelte";
  import type { Block as BlockType, FileUrlOptions } from "@contfu/core";
  import { FILE_URL_CONTEXT_KEY, type BlockComponents } from "./index.js";
  import Block from "./Block.svelte";

  let {
    blocks,
    components = {},
    file,
  }: { blocks: BlockType[]; components?: BlockComponents; file?: FileUrlOptions } = $props();

  if (file) setContext(FILE_URL_CONTEXT_KEY, file);
</script>

{#each blocks as block}
  <Block {block} {components} />
{/each}
